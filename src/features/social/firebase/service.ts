import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  initializeFirestore,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytesResumable, type FirebaseStorage } from 'firebase/storage';
import type { FIREBASE_CONFIG } from '../../../config/social';
import { firebaseConfigured } from '../../../config/social';
import { ARTISTS_SHOWN, CREW_MAX, CREW_NOTE_MAX, CREW_PICKS_MAX, CREW_STAGE_MAX, DROP_FILE_MAX, FOUNDERS_MAX, SUPPORT_MAX, type Activity, type Comment, type Crew, type CrewInvite, type CrewPicks, type CrewUpdate, MEET_SPOT_MAX, type Profile } from '../models';
import { SocialError, MAX_SHARE_BYTES, type SocialService } from '../service';
import { cleanComment, cleanCrewName, cleanProfileInput, commentProblem, crewNameProblem, handleProblem, normalizeHandle, profileProblems } from '../validate';
import { throwbackShares } from '../../memories/throwbackLimit';
import { nextPresence, presenceFromDoc } from '../../admin/presence';
import { asSocialError, dropFromDoc, patchFromDoc, privilegesFrom, commentFromDoc, crewFromDoc, crewInviteFromDoc, crewPicksFromDoc, crewUpdateFromDoc, meetSpotFromDoc, memoryFromDoc, prefixEnd, profileFromDoc, profileToDoc, reportFromDoc, standingFromDocs, supportFromDoc, videoType } from './mapping';
import { cleanBackdrop } from '../../profile/backdrops';

/**
 * Social profiles on Firebase: Authentication (email and password), Cloud
 * Firestore (profiles, handles, shared memories, blocks, reports) and Cloud
 * Storage (shared videos, stills, profile photos). The JavaScript SDK, so it
 * runs in Expo Go; the sign-in is kept in AsyncStorage by Firebase itself.
 *
 * Nothing here is trusted by the database: firestore.rules and storage.rules
 * (repository root) enforce who may write what, the same limits as
 * validate.ts, and file sizes. Firebase starts only on first use, and never
 * when the build has no config.
 *
 * Layout:
 *   profiles/{uid}      handle, displayName, nameLower, bio, avatarUrl, coverUrl, festivals, sounds, createdAt, updatedAt
 *   handles/{handle}    { uid }: one owner per handle
 *   memories/{id}       uid, handle, videoPath, videoUrl, thumbPath, thumbUrl, festivalId, night, artistId, capturedAt, durationSec, width, height, createdAt
 *   blocks/{uid}        { uids: [...] }: only you can read or write yours
 *   follows/{from}_{to} from, to, createdAt: made by `from`, removed by either
 *   likes/{memoryId}_{uid} memoryId, owner, uid, createdAt: made by `uid`, removed by `uid` or the video's owner
 *   crews/{id}          festivalId, name, owner, members (up to 12), createdAt: the id is the invite
 *   crews/{id}/picks/{uid} artists, updatedAt: written by that member, read by members
 *   crews/{id}/updates/{updateId} uid, kind, atMs (when it happened on the phone), sentAt (server time), festivalId,
 *                       artistId, stage, note, videoUrl/thumbUrl (+ videoPath/thumbPath when uploaded for the crew), sharedId, durationSec, width, height
 *   comments/{id}       memoryId, owner, uid, handle, text (≤ 300), createdAt: written as yourself, removed by you or the video's owner
 *   levels/{uid}        level, at: your glow level, shown on your profile unless you switch it off
 *   reports/{id}        by, kind, targetId, ownerUid, reason, note, createdAt: create-only
 * Storage: memories/{uid}/{id}.(mp4|mov|m4v|jpg), avatars/{uid}.jpg, crews/{crewId}/{uid}/{updateId}.(mp4|mov|m4v|jpg) (links only in members-only updates)
 */
type Handles = { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage };

// Metro loads Firebase Auth's React Native build, which has this; the types TypeScript is pointed at leave
// it out (firebase-js-sdk issue 9316), so it's read with its real signature here.
const { getReactNativePersistence } = FirebaseAuth as unknown as { getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence };

export function firebaseSocialService(config: typeof FIREBASE_CONFIG): SocialService {
  let h: Handles | undefined;
  const fb = (): Handles => {
    if (h) return h;
    const app = getApps().length ? getApp() : initializeApp(config);
    let auth: Auth;
    if (Platform.OS === 'web') {
      // In a browser Firebase keeps the sign-in itself (IndexedDB).
      auth = getAuth(app);
    } else {
      try {
        auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
      } catch {
        // Already initialised (a fast refresh in development).
        auth = getAuth(app);
      }
    }
    h = { app, auth, db: initializeFirestore(app, {}), storage: getStorage(app) };
    return h;
  };
  const me = () => {
    const u = fb().auth.currentUser;
    if (!u) throw new SocialError('not-signed-in');
    return u;
  };
  const guard = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (e) {
      throw asSocialError(e);
    }
  };
  const now = () => new Date().toISOString();

  async function upload(path: string, uri: string, contentType: string, onProgress?: (s: number) => void) {
    const blob = await (await fetch(uri)).blob();
    if (blob.size > MAX_SHARE_BYTES) throw new SocialError('too-large');
    const task = uploadBytesResumable(ref(fb().storage, path), blob, { contentType });
    await new Promise<void>((resolve, reject) =>
      task.on('state_changed', (s) => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), reject, () => resolve()),
    );
    return getDownloadURL(task.snapshot.ref);
  }
  /**
   * Writes with the newer profile fields; if the database's rules are older
   * and refuse them, writes again without (so saving a profile never breaks
   * before the rules are deployed).
   */
  async function withOlderRules<T>(write: (legacy: boolean) => Promise<T>, fallback = true): Promise<T> {
    try {
      return await write(false);
    } catch (e) {
      if (!fallback || (e as { code?: string })?.code !== 'permission-denied') throw e;
      return write(true);
    }
  }
  /** Change your profile document. */
  async function updateProfile(change: (p: Profile) => Profile, fallback = true): Promise<Profile> {
    const user = me();
    const profileRef = doc(fb().db, 'profiles', user.uid);
    const current = profileFromDoc(user.uid, (await getDoc(profileRef)).data());
    if (!current) throw new SocialError('no-profile');
    const next = { ...change(current), updatedAt: now() };
    await withOlderRules((legacy) => setDoc(profileRef, profileToDoc(next, legacy)), fallback);
    return next;
  }
  const removeFile = (path: string | undefined) => (path ? deleteObject(ref(fb().storage, path)).catch(() => {}) : Promise.resolve());
  /** A crew's updates (one person's, or everyone's when the crew ends), with their crew-only files. */
  async function removeUpdates(crewId: string, uid?: string) {
    const col = collection(fb().db, 'crews', crewId, 'updates');
    const snap = await getDocs(uid ? query(col, where('uid', '==', uid)) : col);
    for (const d of snap.docs) {
      const data = d.data() as { videoPath?: string; thumbPath?: string };
      await deleteDoc(d.ref).catch(() => {});
      await removeFile(data.videoPath);
      await removeFile(data.thumbPath);
    }
  }

  /**
   * The whole crew goes: what's in it first, as well as it can (a part the
   * database won't let go of never stops the crew ending), then the crew.
   */
  async function endWholeCrew(id: string) {
    const { db } = fb();
    await removeUpdates(id).catch(() => {});
    const picks = await getDocs(collection(db, 'crews', id, 'picks')).catch(() => null);
    for (const d of picks?.docs ?? []) await deleteDoc(d.ref).catch(() => {});
    await deleteDoc(doc(db, 'crews', id, 'meta', 'meet')).catch(() => {});
    await deleteDoc(doc(db, 'crews', id));
  }

  const service: SocialService = {
    availability: () => (firebaseConfigured(config) ? { ok: true } : { ok: false, reason: 'not-set-up' }),

    onAuthChange(listener) {
      if (!firebaseConfigured(config)) {
        listener(null);
        return () => {};
      }
      return onAuthStateChanged(fb().auth, (u) => listener(u ? { uid: u.uid, email: u.email ?? undefined, emailVerified: u.emailVerified } : null));
    },
    signUp: (email, password) =>
      guard(async () => {
        const c = await createUserWithEmailAndPassword(fb().auth, email.trim(), password);
        return { uid: c.user.uid, email: c.user.email ?? undefined, emailVerified: c.user.emailVerified };
      }),
    signIn: (email, password) =>
      guard(async () => {
        const c = await signInWithEmailAndPassword(fb().auth, email.trim(), password);
        return { uid: c.user.uid, email: c.user.email ?? undefined, emailVerified: c.user.emailVerified };
      }),
    signOut: () => guard(() => signOut(fb().auth)),
    sendPasswordReset: (email) => guard(() => sendPasswordResetEmail(fb().auth, email.trim())),

    deleteAccount: (password) =>
      guard(async () => {
        const user = me();
        if (!user.email) throw new SocialError('wrong-password');
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
        const { db } = fb();
        // Shared memories and their files.
        const mine = await getDocs(query(collection(db, 'memories'), where('uid', '==', user.uid)));
        for (const d of mine.docs) {
          const data = d.data() as { videoPath?: string; thumbPath?: string };
          await removeFile(data.videoPath);
          await removeFile(data.thumbPath);
          await deleteDoc(d.ref);
        }
        await removeFile(`avatars/${user.uid}.jpg`);
        await removeFile(`covers/${user.uid}.jpg`);
        // Out of every crew (your picks go with you).
        for (const c of await service.myCrews()) await service.leaveCrew(c.id);
        // Follows and likes either way.
        const snaps = await Promise.all([
          getDocs(query(collection(db, 'follows'), where('from', '==', user.uid))),
          getDocs(query(collection(db, 'follows'), where('to', '==', user.uid))),
          getDocs(query(collection(db, 'likes'), where('uid', '==', user.uid))),
          getDocs(query(collection(db, 'likes'), where('owner', '==', user.uid))),
          getDocs(query(collection(db, 'comments'), where('uid', '==', user.uid))),
          getDocs(query(collection(db, 'comments'), where('owner', '==', user.uid))),
          getDocs(query(collection(db, 'friendLinks'), where('from', '==', user.uid))),
          getDocs(query(collection(db, 'crewInvites'), where('from', '==', user.uid))),
          getDocs(query(collection(db, 'crewInvites'), where('to', '==', user.uid))),
        ]);
        const refs = snaps.flatMap((snap) => snap.docs.map((d) => d.ref));
        for (let i = 0; i < refs.length; i += 400) {
          const b = writeBatch(db);
          for (const r of refs.slice(i, i + 400)) b.delete(r);
          await b.commit();
        }
        // On its own, so a database whose rules predate glow levels never blocks deleting the account.
        await deleteDoc(doc(db, 'levels', user.uid)).catch(() => {});
        const profile = await getDoc(doc(db, 'profiles', user.uid));
        const batch = writeBatch(db);
        const handle = profile.exists() ? (profile.data() as { handle?: string }).handle : undefined;
        if (handle) batch.delete(doc(db, 'handles', handle));
        batch.delete(doc(db, 'profiles', user.uid));
        batch.delete(doc(db, 'blocks', user.uid));
        batch.delete(doc(db, 'friendCodes', user.uid));
        // A founder's number goes with them (the spot isn't given to anyone else).
        batch.delete(doc(db, 'founders', user.uid));
        batch.delete(doc(db, 'activity', user.uid));
        await batch.commit();
        // Once the profile is gone (the rules allow it only then), and never in the way of deleting the account.
        await deleteDoc(doc(db, 'usage', user.uid)).catch(() => {});
        await deleteUser(user);
      }),

    profileOf: (uid) => guard(async () => profileFromDoc(uid, (await getDoc(doc(fb().db, 'profiles', uid))).data())),
    profileByHandle: (handle) =>
      guard(async () => {
        const hdoc = await getDoc(doc(fb().db, 'handles', normalizeHandle(handle)));
        const uid = hdoc.exists() ? (hdoc.data() as { uid?: string }).uid : undefined;
        return uid ? service.profileOf(uid) : null;
      }),
    handleAvailable: (handle) =>
      guard(async () => {
        const h2 = normalizeHandle(handle);
        if (handleProblem(h2)) return false;
        const d = await getDoc(doc(fb().db, 'handles', h2));
        return !d.exists() || (d.data() as { uid?: string }).uid === fb().auth.currentUser?.uid;
      }),

    saveProfile: (raw, published) =>
      guard(async () => {
        const user = me();
        const input = cleanProfileInput(raw);
        if (Object.keys(profileProblems(input)).length) throw new SocialError('unknown', 'Profile has problems');
        const { db } = fb();
        const profileRef = doc(db, 'profiles', user.uid);
        const write = (legacy: boolean) =>
          runTransaction(db, async (tx) => {
            const current = profileFromDoc(user.uid, (await tx.get(profileRef)).data());
            const handleRef = doc(db, 'handles', input.handle);
            const owner = await tx.get(handleRef);
            if (owner.exists() && (owner.data() as { uid?: string }).uid !== user.uid) throw new SocialError('handle-taken');
            if (current && current.handle !== input.handle) tx.delete(doc(db, 'handles', current.handle));
            if (!owner.exists()) tx.set(handleRef, { uid: user.uid });
            const at = now();
            const showArtists = input.showArtists !== false;
            const next: Profile = {
              uid: user.uid,
              handle: input.handle,
              displayName: input.displayName,
              bio: input.bio,
              avatarUrl: current?.avatarUrl,
              coverUrl: current?.coverUrl,
              festivals: input.showFestivals ? published.festivals.slice(0, 50) : [],
              sounds: input.showSound ? published.sounds.slice(0, 3) : [],
              artists: showArtists ? (published.artists ?? current?.artists ?? []).slice(0, ARTISTS_SHOWN) : [],
              showFestivals: input.showFestivals,
              showSound: input.showSound,
              showArtists,
              backdrop: current?.backdrop,
              createdAt: current?.createdAt || at,
              updatedAt: at,
            };
            tx.set(profileRef, profileToDoc(next, legacy));
            return next;
          });
        return withOlderRules(write);
      }),
    setAvatar: (uri) =>
      guard(async () => {
        const user = me();
        const path = `avatars/${user.uid}.jpg`;
        const avatarUrl = uri ? await upload(path, uri, 'image/jpeg') : undefined;
        if (!uri) await removeFile(path);
        return updateProfile((p) => ({ ...p, avatarUrl }));
      }),
    setCover: (uri) =>
      guard(async () => {
        const user = me();
        const path = `covers/${user.uid}.jpg`;
        const coverUrl = uri ? await upload(path, uri, 'image/jpeg') : undefined;
        if (!uri) await removeFile(path);
        return updateProfile((p) => ({ ...p, coverUrl }));
      }),
    setBackdrop: (id) =>
      guard(async () => {
        const backdrop = cleanBackdrop(id ?? undefined);
        // Never quietly dropped: a database that doesn't know backgrounds yet says so.
        return updateProfile((p) => ({ ...p, backdrop }), false);
      }),
    searchProfiles: (raw) =>
      guard(async () => {
        const q = raw.trim().replace(/^@+/, '').toLowerCase();
        if (q.length < 2) return [];
        const { db } = fb();
        const [byHandle, byName] = await Promise.all([
          getDocs(query(collection(db, 'profiles'), where('handle', '>=', q), where('handle', '<=', prefixEnd(q)), limit(20))),
          getDocs(query(collection(db, 'profiles'), where('nameLower', '>=', q), where('nameLower', '<=', prefixEnd(q)), limit(20))),
        ]);
        const out = new Map<string, Profile>();
        for (const d of [...byHandle.docs, ...byName.docs]) {
          const p = profileFromDoc(d.id, d.data());
          if (p) out.set(p.uid, p);
        }
        return [...out.values()].slice(0, 20);
      }),

    profilesGoingTo: (festivalId, max) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'profiles'), where('festivals', 'array-contains', festivalId), limit(max)));
        return snap.docs.map((d) => profileFromDoc(d.id, d.data())).filter((p): p is Profile => !!p);
      }),

    shareMemory: (input, onProgress) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        const profile = profileFromDoc(user.uid, (await getDoc(doc(db, 'profiles', user.uid))).data());
        if (!profile) throw new SocialError('no-profile');
        const memRef = doc(collection(db, 'memories'));
        const ext = videoType(input.videoUri) === 'video/quicktime' ? 'mov' : videoType(input.videoUri) === 'video/x-m4v' ? 'm4v' : 'mp4';
        const videoPath = `memories/${user.uid}/${memRef.id}.${ext}`;
        const thumbPath = input.thumbUri ? `memories/${user.uid}/${memRef.id}.jpg` : undefined;
        try {
          const videoUrl = await upload(videoPath, input.videoUri, videoType(input.videoUri), (s) => onProgress?.(s * 0.95));
          const thumbUrl = input.thumbUri && thumbPath ? await upload(thumbPath, input.thumbUri, 'image/jpeg') : undefined;
          const shared = {
            uid: user.uid,
            handle: profile.handle,
            memoryId: input.memoryId,
            videoPath,
            videoUrl,
            ...(thumbPath && thumbUrl ? { thumbPath, thumbUrl } : {}),
            ...(input.festivalId ? { festivalId: input.festivalId } : {}),
            ...(input.night ? { night: input.night } : {}),
            ...(input.artistId ? { artistId: input.artistId } : {}),
            // A past festival: its name, year, town and the same festival on Afterglow, as plain fields.
            ...(!input.festivalId && input.past
              ? {
                  pastName: input.past.name,
                  pastYear: input.past.year,
                  ...(input.past.city ? { pastCity: input.past.city } : {}),
                  ...(input.past.seriesId ? { seriesId: input.past.seriesId } : {}),
                }
              : {}),
            capturedAt: input.capturedAt,
            ...(input.durationSec ? { durationSec: input.durationSec } : {}),
            ...(input.width && input.height ? { width: input.width, height: input.height } : {}),
            createdAt: now(),
          };
          if (!input.festivalId && input.past) {
            // A throwback: counted, a few free and as many as you like with Plus (the rules hold the same line).
            const usageRef = doc(db, 'usage', user.uid);
            const used = Number((await getDoc(usageRef)).data()?.throwbacks) || 0;
            const plus = standingFromDocs(undefined, undefined, (await getDoc(doc(db, 'plus', user.uid)).catch(() => undefined))?.data()).plus;
            if (!throwbackShares({ plus: !!plus, used }).canShare) throw new SocialError('throwback-limit');
            const b = writeBatch(db);
            b.set(memRef, shared);
            b.set(usageRef, { throwbacks: used + 1, memory: memRef.id });
            await b.commit();
          } else await setDoc(memRef, shared);
          onProgress?.(1);
          return memoryFromDoc(memRef.id, shared)!;
        } catch (e) {
          // Nothing half-shared: files that made it up are removed again.
          await removeFile(videoPath);
          await removeFile(thumbPath);
          throw e;
        }
      }),
    unshareMemory: (id) =>
      guard(async () => {
        const user = me();
        const memRef = doc(fb().db, 'memories', id);
        const d = await getDoc(memRef);
        if (!d.exists()) return;
        const data = d.data() as { uid?: string; videoPath?: string; thumbPath?: string; pastName?: string };
        if (data.uid !== user.uid) throw new SocialError('not-signed-in');
        // Its likes and comments go with it.
        const said = await getDocs(query(collection(fb().db, 'comments'), where('memoryId', '==', id), where('owner', '==', user.uid)));
        for (const d of said.docs) await deleteDoc(d.ref).catch(() => {});
        const liked = await getDocs(query(collection(fb().db, 'likes'), where('memoryId', '==', id), where('owner', '==', user.uid)));
        for (let i = 0; i < liked.docs.length; i += 400) {
          const b = writeBatch(fb().db);
          for (const d of liked.docs.slice(i, i + 400)) b.delete(d.ref);
          await b.commit();
        }
        if (data.pastName) {
          // A throwback gives its place back.
          const usageRef = doc(fb().db, 'usage', user.uid);
          const used = Number((await getDoc(usageRef)).data()?.throwbacks) || 0;
          const b = writeBatch(fb().db);
          b.delete(memRef);
          if (used > 0) b.set(usageRef, { throwbacks: used - 1, memory: id });
          await b.commit();
        } else await deleteDoc(memRef);
        await removeFile(data.videoPath);
        await removeFile(data.thumbPath);
      }),
    memoriesOf: (uid) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'memories'), where('uid', '==', uid), orderBy('capturedAt', 'desc'), limit(60)));
        return snap.docs.map((d) => memoryFromDoc(d.id, d.data())).filter((m): m is NonNullable<typeof m> => !!m);
      }),
    festivalMemories: (festivalId, max) =>
      guard(async () => {
        const memories = collection(fb().db, 'memories');
        const [here, before] = await Promise.all([
          getDocs(query(memories, where('festivalId', '==', festivalId), orderBy('createdAt', 'desc'), limit(max))),
          // Throwbacks from earlier years of the same festival; a database without that index yet just has none.
          getDocs(query(memories, where('seriesId', '==', festivalId), orderBy('createdAt', 'desc'), limit(max))).catch(() => undefined),
        ]);
        return [...here.docs, ...(before?.docs ?? [])]
          .map((d) => memoryFromDoc(d.id, d.data()))
          .filter((m): m is NonNullable<typeof m> => !!m)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, max);
      }),
    recentMemories: (max) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'memories'), orderBy('createdAt', 'desc'), limit(max)));
        return snap.docs.map((d) => memoryFromDoc(d.id, d.data())).filter((m): m is NonNullable<typeof m> => !!m);
      }),
    sharedMemory: (id) => guard(async () => memoryFromDoc(id, (await getDoc(doc(fb().db, 'memories', id))).data())),

    follow: (uid) =>
      guard(async () => {
        const user = me();
        if (uid === user.uid) throw new SocialError('unknown');
        await setDoc(doc(fb().db, 'follows', `${user.uid}_${uid}`), { from: user.uid, to: uid, createdAt: now() });
      }),
    claimFounder: () =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        const mine = doc(db, 'founders', user.uid);
        const counter = doc(db, 'counters', 'founders');
        // One transaction: the counter and your number move together, so two people never share a number.
        return runTransaction(db, async (tx) => {
          const had = await tx.get(mine);
          if (had.exists()) return standingFromDocs(had.data(), undefined).founder ?? null;
          const c = await tx.get(counter);
          const count = c.exists() ? Number((c.data() as { count?: unknown }).count) || 0 : 0;
          if (count >= FOUNDERS_MAX) return null;
          const number = count + 1;
          tx.set(counter, { count: number });
          tx.set(mine, { number, at: serverTimestamp() });
          return number;
        });
      }),
    standingOf: (uid) =>
      guard(async () => {
        const { db } = fb();
        // The level has its own catch: a database whose rules predate it refuses the read, and that must not hide the rest.
        const [f, fl, pl, lv] = await Promise.all([
          getDoc(doc(db, 'founders', uid)),
          getDoc(doc(db, 'flairs', uid)),
          getDoc(doc(db, 'plus', uid)),
          getDoc(doc(db, 'levels', uid)).catch(() => undefined),
        ]);
        return standingFromDocs(f.data(), fl.data(), pl.data(), lv?.data());
      }),
    throwbackUsage: () =>
      guard(async () => {
        const user = me();
        return Number((await getDoc(doc(fb().db, 'usage', user.uid))).data()?.throwbacks) || 0;
      }),
    setLevel: (level) =>
      guard(async () => {
        const user = me();
        const ref = doc(fb().db, 'levels', user.uid);
        if (level === null) await deleteDoc(ref);
        else await setDoc(ref, { level, at: serverTimestamp() });
      }),
    sendVerification: () => guard(async () => sendEmailVerification(me() as FirebaseAuth.User)),
    reloadUser: () =>
      guard(async () => {
        const u = fb().auth.currentUser;
        if (!u) return null;
        await reload(u);
        // A fresh token carries the verified flag the rules check.
        await u.getIdToken(true);
        return { uid: u.uid, email: u.email ?? undefined, emailVerified: u.emailVerified };
      }),

    contactSupport: (input) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        const text = input.text.trim().slice(0, SUPPORT_MAX);
        if (!text) throw new SocialError('unknown');
        const profile = profileFromDoc(user.uid, (await getDoc(doc(db, 'profiles', user.uid))).data());
        const ref_ = doc(collection(db, 'support'));
        const data = {
          uid: user.uid,
          topic: input.topic,
          text,
          status: 'open',
          createdAt: serverTimestamp(),
          ...(profile ? { handle: profile.handle, name: profile.displayName.slice(0, 60) } : {}),
          ...(user.email ? { email: user.email.slice(0, 200) } : {}),
          ...(input.platform ? { platform: input.platform.slice(0, 20) } : {}),
          ...(input.version ? { version: input.version.slice(0, 80) } : {}),
        };
        await setDoc(ref_, data);
        return supportFromDoc(ref_.id, { ...data, createdAt: now() })!;
      }),
    mySupport: (max) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'support'), where('uid', '==', me().uid), orderBy('createdAt', 'desc'), limit(max)));
        return snap.docs.map((d) => supportFromDoc(d.id, d.data())).filter((m): m is NonNullable<typeof m> => !!m);
      }),
    supportInbox: (max) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'support'), orderBy('createdAt', 'desc'), limit(max)));
        return snap.docs.map((d) => supportFromDoc(d.id, d.data())).filter((m): m is NonNullable<typeof m> => !!m);
      }),
    answerSupport: (id, reply) =>
      guard(async () => {
        await updateDoc(doc(fb().db, 'support', id), { reply: reply.trim().slice(0, 2000), repliedAt: now(), status: 'answered' });
      }),
    setSupportStatus: (id, status) => guard(async () => updateDoc(doc(fb().db, 'support', id), { status })),
    reports: (max) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'reports'), orderBy('createdAt', 'desc'), limit(max)));
        return snap.docs.map((d) => reportFromDoc(d.id, d.data())).filter((r): r is NonNullable<typeof r> => !!r);
      }),
    resolveReport: (id) => guard(async () => updateDoc(doc(fb().db, 'reports', id), { status: 'resolved', resolvedAt: now() })),
    takeDown: (kind, id) =>
      guard(async () => {
        const { db } = fb();
        if (kind === 'comment') return deleteDoc(doc(db, 'comments', id));
        const ref_ = doc(db, 'memories', id);
        const data = (await getDoc(ref_)).data() as { videoPath?: string; thumbPath?: string } | undefined;
        await removeFile(data?.videoPath);
        await removeFile(data?.thumbPath);
        await deleteDoc(ref_);
      }),
    adminCounts: (since) =>
      guard(async () => {
        const { db } = fb();
        const count = async (q: Parameters<typeof getCountFromServer>[0]) => (await getCountFromServer(q)).data().count;
        // A collection the rules don't let us count yet (not deployed) reads as 0 rather than failing the page.
        const soft = (p: Promise<number>) => p.catch(() => 0);
        const [people, peopleThisWeek, videos, videosThisWeek, follows, likes, comments, crews, supportOpen, supportTotal, reports, reportsResolved, founders, accounts, crewInvites] = await Promise.all([
          count(collection(db, 'profiles')),
          count(query(collection(db, 'profiles'), where('createdAt', '>=', since))),
          count(collection(db, 'memories')),
          count(query(collection(db, 'memories'), where('createdAt', '>=', since))),
          count(collection(db, 'follows')),
          count(collection(db, 'likes')),
          count(collection(db, 'comments')),
          count(collection(db, 'crews')),
          count(query(collection(db, 'support'), where('status', '==', 'open'))),
          soft(count(collection(db, 'support'))),
          count(collection(db, 'reports')),
          soft(count(query(collection(db, 'reports'), where('status', '==', 'resolved')))),
          getDoc(doc(db, 'counters', 'founders')).then((d) => Number((d.data() as { count?: unknown } | undefined)?.count) || 0),
          soft(count(collection(db, 'activity'))),
          soft(count(collection(db, 'crewInvites'))),
        ]);
        return { people, peopleThisWeek, videos, videosThisWeek, follows, likes, comments, crews, founders, supportOpen, supportTotal, reports, reportsOpen: Math.max(0, reports - reportsResolved), accounts, crewInvites };
      }),
    adminActivity: (since, max) =>
      guard(async () => {
        const { db } = fb();
        const recent = (name: string) => getDocs(query(collection(db, name), where('createdAt', '>=', since), orderBy('createdAt', 'desc'), limit(max)));
        const empty = { docs: [] as { data: () => unknown }[] };
        const [p, m, c, l, f, cr] = await Promise.all([
          recent('profiles'),
          recent('memories'),
          recent('comments').catch(() => empty),
          recent('likes').catch(() => empty),
          recent('follows').catch(() => empty),
          recent('crews').catch(() => empty),
        ]);
        const at = (d: { data: () => unknown }) => (d.data() as { createdAt?: unknown }).createdAt;
        const times = (snap: { docs: { data: () => unknown }[] }) => snap.docs.map(at).filter((x): x is string => typeof x === 'string');
        const s = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
        return {
          signups: times(p),
          videos: m.docs.flatMap((d) => {
            const o = d.data() as Record<string, unknown>;
            const createdAt = s(o.createdAt);
            const uid = s(o.uid);
            if (!createdAt || !uid) return [];
            return [{ createdAt, uid, handle: s(o.handle), artistId: s(o.artistId), festivalId: s(o.festivalId), durationSec: typeof o.durationSec === 'number' ? o.durationSec : undefined }];
          }),
          comments: times(c),
          likes: times(l),
          follows: times(f),
          crews: times(cr),
        };
      }),
    adminPresence: (max) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'activity'), orderBy('lastSeenAt', 'desc'), limit(max)));
        return snap.docs.map((d) => presenceFromDoc(d.id, d.data())).filter((x): x is NonNullable<typeof x> => !!x);
      }),
    addDrop: (input, onProgress) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        const ref_ = doc(collection(db, 'drops'));
        const files = [];
        for (const [i, f] of input.files.entries()) {
          const name = f.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80) || `file-${i + 1}`;
          const path = `drops/${ref_.id}/${i + 1}-${name}`;
          const blob = await (await fetch(f.uri)).blob();
          if (blob.size > DROP_FILE_MAX) throw new SocialError('too-large');
          const task = uploadBytesResumable(ref(fb().storage, path), blob, { contentType: f.type || blob.type || 'application/octet-stream' });
          await new Promise<void>((resolve, reject) =>
            task.on('state_changed', (s) => onProgress?.((i + (s.totalBytes ? s.bytesTransferred / s.totalBytes : 0)) / input.files.length), reject, () => resolve()),
          );
          files.push({ name: f.name.slice(0, 120), type: f.type || blob.type || '', size: blob.size, path, url: await getDownloadURL(task.snapshot.ref) });
        }
        const data = {
          by: user.uid,
          note: input.note.trim().slice(0, 500),
          files,
          status: 'waiting',
          createdAt: serverTimestamp(),
          ...(input.festivalId ? { festivalId: input.festivalId } : {}),
          ...(input.festivalName?.trim() ? { festivalName: input.festivalName.trim().slice(0, 120) } : {}),
          ...(input.text?.trim() ? { text: input.text.trim().slice(0, 50_000) } : {}),
        };
        await setDoc(ref_, data);
        return dropFromDoc(ref_.id, { ...data, createdAt: now() })!;
      }),
    drops: (max) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'drops'), orderBy('createdAt', 'desc'), limit(max)));
        return snap.docs.map((d) => dropFromDoc(d.id, d.data())).filter((x): x is NonNullable<typeof x> => !!x);
      }),
    setDropStatus: (id, status) => guard(async () => updateDoc(doc(fb().db, 'drops', id), { status })),
    deleteDrop: (id) =>
      guard(async () => {
        const ref_ = doc(fb().db, 'drops', id);
        const drop = dropFromDoc(id, (await getDoc(ref_)).data());
        for (const f of drop?.files ?? []) await removeFile(f.path);
        await deleteDoc(ref_);
      }),
    livePatches: () =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'published'), orderBy('publishedAt', 'asc'), limit(200)));
        return snap.docs.map((d) => patchFromDoc(d.id, d.data())).filter((x): x is NonNullable<typeof x> => !!x);
      }),
    publishPatch: (input) =>
      guard(async () => {
        const user = me();
        const ref_ = doc(collection(fb().db, 'published'));
        const data = { title: input.title.slice(0, 120), festivalId: input.festivalId, file: input.file, by: user.uid, publishedAt: serverTimestamp(), ...(input.dropId ? { dropId: input.dropId } : {}) };
        await setDoc(ref_, data);
        return patchFromDoc(ref_.id, { ...data, publishedAt: now() })!;
      }),
    unpublishPatch: (id) => guard(async () => deleteDoc(doc(fb().db, 'published', id))),
    setPlus: (uid, plus) =>
      guard(async () => {
        const ref_ = doc(fb().db, 'plus', uid);
        if (!plus) return deleteDoc(ref_);
        await setDoc(ref_, { active: true, ...(plus.until ? { until: plus.until } : {}) });
      }),
    setFlair: (uid, flair) =>
      guard(async () => {
        const ref_ = doc(fb().db, 'flairs', uid);
        if (!flair) return deleteDoc(ref_);
        await setDoc(ref_, { kind: flair.kind, caption: flair.caption.trim().slice(0, 40) });
      }),
    privileged: () =>
      guard(async () => {
        const { db } = fb();
        const [p, f] = await Promise.all([getDocs(query(collection(db, 'plus'), limit(500))), getDocs(query(collection(db, 'flairs'), limit(500)))]);
        return privilegesFrom(
          p.docs.map((d) => ({ id: d.id, data: d.data() })),
          f.docs.map((d) => ({ id: d.id, data: d.data() })),
        );
      }),
    markActive: (input) =>
      guard(async () => {
        const ref_ = doc(fb().db, 'activity', me().uid);
        const prev = presenceFromDoc(me().uid, (await getDoc(ref_)).data());
        await setDoc(ref_, nextPresence(prev, input));
      }),
    adminFestivals: (ids) =>
      guard(async () => {
        const { db } = fb();
        const out: Record<string, { going: number; videos: number }> = {};
        await Promise.all(
          ids.map(async (id) => {
            const [going, videos] = await Promise.all([
              getCountFromServer(query(collection(db, 'profiles'), where('festivals', 'array-contains', id))),
              getCountFromServer(query(collection(db, 'memories'), where('festivalId', '==', id))),
            ]);
            out[id] = { going: going.data().count, videos: videos.data().count };
          }),
        );
        return out;
      }),
    setFriendCode: (code) => guard(async () => setDoc(doc(fb().db, 'friendCodes', me().uid), { code, updatedAt: serverTimestamp() })),
    addFriend: (uid, code) =>
      guard(async () => {
        const user = me();
        if (uid === user.uid) throw new SocialError('unknown');
        const db = fb().db;
        // Follows are never rewritten, so only the missing ones are made, with the proof in the same batch.
        const [mine, theirs] = await Promise.all([getDoc(doc(db, 'follows', `${user.uid}_${uid}`)), getDoc(doc(db, 'follows', `${uid}_${user.uid}`))]);
        const batch = writeBatch(db);
        batch.set(doc(db, 'friendLinks', `${user.uid}_${uid}`), { from: user.uid, to: uid, code, createdAt: now() });
        if (!mine.exists()) batch.set(doc(db, 'follows', `${user.uid}_${uid}`), { from: user.uid, to: uid, createdAt: now() });
        if (!theirs.exists()) batch.set(doc(db, 'follows', `${uid}_${user.uid}`), { from: uid, to: user.uid, createdAt: now(), via: 'code' });
        await batch.commit();
      }),
    unfollow: (uid) => guard(async () => deleteDoc(doc(fb().db, 'follows', `${me().uid}_${uid}`))),
    removeFollower: (uid) => guard(async () => deleteDoc(doc(fb().db, 'follows', `${uid}_${me().uid}`))),
    following: (uid, max) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'follows'), where('from', '==', uid), orderBy('createdAt', 'desc'), limit(max)));
        return snap.docs.map((d) => (d.data() as { to?: unknown }).to).filter((x): x is string => typeof x === 'string');
      }),
    followers: (uid, max) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'follows'), where('to', '==', uid), orderBy('createdAt', 'desc'), limit(max)));
        return snap.docs.map((d) => (d.data() as { from?: unknown }).from).filter((x): x is string => typeof x === 'string');
      }),
    followCounts: (uid) =>
      guard(async () => {
        const follows = collection(fb().db, 'follows');
        const [followers, following] = await Promise.all([
          getCountFromServer(query(follows, where('to', '==', uid))),
          getCountFromServer(query(follows, where('from', '==', uid))),
        ]);
        return { followers: followers.data().count, following: following.data().count };
      }),
    memoriesBy: (uids, max) =>
      guard(async () => {
        // Firestore takes at most 30 values in one `in`; ask in groups and merge, newest first.
        const groups: string[][] = [];
        for (let i = 0; i < uids.length; i += 30) groups.push(uids.slice(i, i + 30));
        const snaps = await Promise.all(
          groups.map((g) => getDocs(query(collection(fb().db, 'memories'), where('uid', 'in', g), orderBy('createdAt', 'desc'), limit(max)))),
        );
        return snaps
          .flatMap((snap) => snap.docs.map((d) => memoryFromDoc(d.id, d.data())))
          .filter((m): m is NonNullable<typeof m> => !!m)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, max);
      }),

    like: (memoryId, owner) =>
      guard(async () => {
        const user = me();
        if (owner === user.uid) throw new SocialError('unknown');
        await setDoc(doc(fb().db, 'likes', `${memoryId}_${user.uid}`), { memoryId, owner, uid: user.uid, createdAt: now() });
      }),
    unlike: (memoryId) => guard(async () => deleteDoc(doc(fb().db, 'likes', `${memoryId}_${me().uid}`))),
    likeCount: (memoryId) =>
      guard(async () => (await getCountFromServer(query(collection(fb().db, 'likes'), where('memoryId', '==', memoryId)))).data().count),
    likedBy: (memoryId, max) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'likes'), where('memoryId', '==', memoryId), orderBy('createdAt', 'desc'), limit(max)));
        return snap.docs.map((d) => (d.data() as { uid?: unknown }).uid).filter((x): x is string => typeof x === 'string');
      }),
    comment: (memoryId, owner, raw) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        if (commentProblem(raw)) throw new SocialError('unknown');
        const profile = profileFromDoc(user.uid, (await getDoc(doc(db, 'profiles', user.uid))).data());
        if (!profile) throw new SocialError('no-profile');
        const ref_ = doc(collection(db, 'comments'));
        const data = { memoryId, owner, uid: user.uid, handle: profile.handle, text: cleanComment(raw), createdAt: now() };
        await setDoc(ref_, data);
        return { id: ref_.id, ...data };
      }),
    comments: (memoryId, max) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'comments'), where('memoryId', '==', memoryId), orderBy('createdAt', 'asc'), limit(max)));
        return snap.docs.map((d) => commentFromDoc(d.id, d.data())).filter((c): c is Comment => !!c);
      }),
    commentCount: (memoryId) =>
      guard(async () => (await getCountFromServer(query(collection(fb().db, 'comments'), where('memoryId', '==', memoryId)))).data().count),
    deleteComment: (id) => guard(async () => deleteDoc(doc(fb().db, 'comments', id))),
    activity: (max) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        const [followed, liked, said] = await Promise.all([
          getDocs(query(collection(db, 'follows'), where('to', '==', user.uid), orderBy('createdAt', 'desc'), limit(max))),
          getDocs(query(collection(db, 'likes'), where('owner', '==', user.uid), orderBy('createdAt', 'desc'), limit(max))),
          getDocs(query(collection(db, 'comments'), where('owner', '==', user.uid), orderBy('createdAt', 'desc'), limit(max))),
        ]);
        const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
        const items: Activity[] = [];
        for (const d of followed.docs) {
          const f = d.data() as { from?: unknown; createdAt?: unknown };
          if (str(f.from) && str(f.createdAt)) items.push({ kind: 'follow', id: d.id, from: f.from, createdAt: f.createdAt });
        }
        for (const d of liked.docs) {
          const l = d.data() as { uid?: unknown; memoryId?: unknown; createdAt?: unknown };
          if (str(l.uid) && str(l.memoryId) && str(l.createdAt)) items.push({ kind: 'like', id: d.id, from: l.uid, memoryId: l.memoryId, createdAt: l.createdAt });
        }
        for (const d of said.docs) {
          const c = commentFromDoc(d.id, d.data());
          // Your own comments on your own videos aren't news.
          if (c && c.uid !== user.uid) items.push({ kind: 'comment', id: c.id, from: c.uid, memoryId: c.memoryId, text: c.text, createdAt: c.createdAt });
        }
        return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
      }),

    createCrew: (festivalId, raw) =>
      guard(async () => {
        const user = me();
        if (crewNameProblem(raw)) throw new SocialError('unknown');
        const crewRef = doc(collection(fb().db, 'crews'));
        const data = { festivalId, name: cleanCrewName(raw), owner: user.uid, members: [user.uid], createdAt: now() };
        await setDoc(crewRef, data);
        return { id: crewRef.id, ...data };
      }),
    crew: (id) => guard(async () => crewFromDoc(id, (await getDoc(doc(fb().db, 'crews', id))).data())),
    myCrews: () =>
      guard(async () => {
        const user = me();
        const snap = await getDocs(query(collection(fb().db, 'crews'), where('members', 'array-contains', user.uid), limit(50)));
        return snap.docs.map((d) => crewFromDoc(d.id, d.data())).filter((c): c is Crew => !!c);
      }),
    joinCrew: (id) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        return runTransaction(db, async (tx) => {
          const crewRef = doc(db, 'crews', id);
          const c = crewFromDoc(id, (await tx.get(crewRef)).data());
          if (!c) throw new SocialError('not-found');
          if (c.members.includes(user.uid)) return c;
          if (c.members.length >= CREW_MAX) throw new SocialError('crew-full');
          const members = [...c.members, user.uid];
          tx.update(crewRef, { members });
          return { ...c, members };
        }).then(async (c) => {
          // An invite to it is done with.
          await deleteDoc(doc(db, 'crewInvites', `${id}_${user.uid}`)).catch(() => {});
          return c;
        });
      }),
    inviteToCrew: (crewId, uid) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        if (uid === user.uid) return;
        const c = crewFromDoc(crewId, (await getDoc(doc(db, 'crews', crewId))).data());
        if (!c || !c.members.includes(user.uid)) throw new SocialError('not-found');
        if (c.members.includes(uid)) return;
        await setDoc(doc(db, 'crewInvites', `${crewId}_${uid}`), {
          crewId,
          festivalId: c.festivalId,
          crewName: c.name.slice(0, 40),
          from: user.uid,
          to: uid,
          createdAt: serverTimestamp(),
        });
      }),
    crewInvites: (max) =>
      guard(async () => {
        const user = me();
        const snap = await getDocs(query(collection(fb().db, 'crewInvites'), where('to', '==', user.uid), orderBy('createdAt', 'desc'), limit(max)));
        return snap.docs.map((d) => crewInviteFromDoc(d.id, d.data())).filter((i): i is CrewInvite => !!i);
      }),
    sentCrewInvites: (crewId) =>
      guard(async () => {
        const user = me();
        const snap = await getDocs(query(collection(fb().db, 'crewInvites'), where('crewId', '==', crewId), where('from', '==', user.uid), limit(100)));
        return snap.docs.map((d) => crewInviteFromDoc(d.id, d.data())?.to).filter((u): u is string => !!u);
      }),
    declineCrewInvite: (crewId) =>
      guard(async () => {
        const user = me();
        await deleteDoc(doc(fb().db, 'crewInvites', `${crewId}_${user.uid}`));
      }),
    leaveCrew: (id) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        const crewRef = doc(db, 'crews', id);
        const c = crewFromDoc(id, (await getDoc(crewRef)).data());
        if (!c || !c.members.includes(user.uid)) return;
        const members = c.members.filter((m) => m !== user.uid);
        if (!members.length) {
          // The last one out ends it.
          await endWholeCrew(id);
          return;
        }
        // Your updates and picks go with you.
        await removeUpdates(id, user.uid).catch(() => {});
        await deleteDoc(doc(db, 'crews', id, 'picks', user.uid));
        await updateDoc(crewRef, { members, owner: c.owner === user.uid ? members[0] : c.owner });
      }),
    endCrew: (id) =>
      guard(async () => {
        const user = me();
        const c = crewFromDoc(id, (await getDoc(doc(fb().db, 'crews', id))).data());
        if (!c) return;
        if (c.owner !== user.uid) throw new SocialError('unknown');
        await endWholeCrew(id);
      }),
    renameCrew: (id, raw) =>
      guard(async () => {
        if (crewNameProblem(raw)) throw new SocialError('unknown');
        const crewRef = doc(fb().db, 'crews', id);
        const name = cleanCrewName(raw);
        await updateDoc(crewRef, { name });
        const c = crewFromDoc(id, (await getDoc(crewRef)).data());
        if (!c) throw new SocialError('not-found');
        return c;
      }),
    removeFromCrew: (id, uid) =>
      guard(async () => {
        const { db } = fb();
        const crewRef = doc(db, 'crews', id);
        const c = crewFromDoc(id, (await getDoc(crewRef)).data());
        if (!c) throw new SocialError('not-found');
        await removeUpdates(id, uid).catch(() => {});
        await deleteDoc(doc(db, 'crews', id, 'picks', uid));
        const members = c.members.filter((m) => m !== uid);
        await updateDoc(crewRef, { members });
        return { ...c, members };
      }),
    setCrewPicks: (id, artists) =>
      guard(async () => {
        const user = me();
        await setDoc(doc(fb().db, 'crews', id, 'picks', user.uid), { artists: [...new Set(artists)].slice(0, CREW_PICKS_MAX), updatedAt: now() });
      }),
    crewPicks: (id) =>
      guard(async () => {
        const snap = await getDocs(collection(fb().db, 'crews', id, 'picks'));
        return snap.docs.map((d) => crewPicksFromDoc(d.id, d.data())).filter((p): p is CrewPicks => !!p);
      }),

    postCrewUpdate: (crewId, input, onProgress) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        const ref_ = doc(db, 'crews', crewId, 'updates', input.id);
        // A retry after a dropped connection: it already made it.
        const existing = await getDoc(ref_);
        if (existing.exists()) {
          const done = crewUpdateFromDoc(crewId, input.id, existing.data());
          if (done) return done;
        }
        let videoUrl = input.videoUrl;
        let thumbUrl = input.thumbUrl;
        let videoPath: string | undefined;
        let thumbPath: string | undefined;
        if (input.kind === 'video' && !videoUrl) {
          if (!input.videoUri) throw new SocialError('unknown');
          const type = videoType(input.videoUri);
          const ext = type === 'video/quicktime' ? 'mov' : type === 'video/x-m4v' ? 'm4v' : 'mp4';
          videoPath = `crews/${crewId}/${user.uid}/${input.id}.${ext}`;
          videoUrl = await upload(videoPath, input.videoUri, type, (s) => onProgress?.(s * 0.95));
          if (input.thumbUri) {
            thumbPath = `crews/${crewId}/${user.uid}/${input.id}.jpg`;
            thumbUrl = await upload(thumbPath, input.thumbUri, 'image/jpeg').catch(() => undefined);
            if (!thumbUrl) thumbPath = undefined;
          }
        }
        if (input.kind === 'photo' && !thumbUrl) {
          // A photo for the crew only: uploaded to the crew's own folder.
          if (!input.thumbUri) throw new SocialError('unknown');
          thumbPath = `crews/${crewId}/${user.uid}/${input.id}.jpg`;
          thumbUrl = await upload(thumbPath, input.thumbUri, 'image/jpeg', (s) => onProgress?.(s * 0.95));
        }
        const data = {
          uid: user.uid,
          kind: input.kind,
          atMs: Date.parse(input.at),
          sentAt: serverTimestamp(),
          festivalId: input.festivalId,
          ...(input.artistId ? { artistId: input.artistId } : {}),
          ...(input.stage ? { stage: input.stage.slice(0, CREW_STAGE_MAX) } : {}),
          ...(input.note ? { note: input.note.slice(0, CREW_NOTE_MAX) } : {}),
          ...(input.kind === 'reply' && input.replyTo ? { replyTo: input.replyTo } : {}),
          ...(input.kind === 'checkin' && input.lost ? { lost: true } : {}),
          ...(input.kind === 'checkin' && input.care ? { care: input.care } : {}),
          ...(videoUrl ? { videoUrl } : {}),
          ...(thumbUrl ? { thumbUrl } : {}),
          ...(videoPath ? { videoPath } : {}),
          ...(thumbPath ? { thumbPath } : {}),
          ...(input.sharedId ? { sharedId: input.sharedId } : {}),
          ...(input.durationSec ? { durationSec: input.durationSec } : {}),
          ...(input.width && input.height ? { width: input.width, height: input.height } : {}),
        };
        try {
          await setDoc(ref_, data);
        } catch (e) {
          await removeFile(videoPath);
          await removeFile(thumbPath);
          throw e;
        }
        onProgress?.(1);
        return crewUpdateFromDoc(crewId, input.id, { ...data, sentAt: Date.now() })!;
      }),
    crewUpdates: (crewId, sinceMs, max) =>
      guard(async () => {
        const snap = await getDocs(
          query(collection(fb().db, 'crews', crewId, 'updates'), where('atMs', '>=', sinceMs), orderBy('atMs', 'desc'), limit(max)),
        );
        return snap.docs.map((d) => crewUpdateFromDoc(crewId, d.id, d.data())).filter((u): u is CrewUpdate => !!u);
      }),
    meetSpot: (crewId) =>
      guard(async () => meetSpotFromDoc((await getDoc(doc(fb().db, 'crews', crewId, 'meta', 'meet'))).data())),
    setMeetSpot: (crewId, raw) =>
      guard(async () => {
        const user = me();
        const ref_ = doc(fb().db, 'crews', crewId, 'meta', 'meet');
        const text = raw.replace(/\s+/g, ' ').trim().slice(0, MEET_SPOT_MAX);
        if (!text) {
          await deleteDoc(ref_);
          return null;
        }
        await setDoc(ref_, { text, by: user.uid, at: serverTimestamp() });
        return { text, by: user.uid, at: new Date().toISOString() };
      }),
    forgetCrewVideos: (crewId, ids) =>
      guard(async () => {
        const user = me();
        // The files are named after the update; the video's type isn't known, so each is tried. A file
        // that isn't there is fine; any other failure (no signal) throws, so the phone tries again later.
        for (const id of ids)
          for (const ext of ['mp4', 'mov', 'm4v', 'jpg']) {
            await deleteObject(ref(fb().storage, `crews/${crewId}/${user.uid}/${id}.${ext}`)).catch((e: unknown) => {
              if ((e as { code?: string })?.code !== 'storage/object-not-found') throw e;
            });
          }
      }),
    deleteCrewUpdate: (crewId, id) =>
      guard(async () => {
        const user = me();
        const ref_ = doc(fb().db, 'crews', crewId, 'updates', id);
        const d = await getDoc(ref_);
        if (!d.exists()) return;
        const data = d.data() as { uid?: string; videoPath?: string; thumbPath?: string };
        if (data.uid !== user.uid) throw new SocialError('not-signed-in');
        await deleteDoc(ref_);
        await removeFile(data.videoPath);
        await removeFile(data.thumbPath);
      }),

    report: (target, reason, note) =>
      guard(async () => {
        const user = me();
        await setDoc(doc(collection(fb().db, 'reports')), {
          by: user.uid,
          kind: target.kind,
          targetId: target.id,
          ownerUid: target.ownerUid,
          reason,
          note: (note ?? '').slice(0, 500),
          createdAt: now(),
        });
      }),
    blocked: () =>
      guard(async () => {
        const user = fb().auth.currentUser;
        if (!user) return [];
        const d = await getDoc(doc(fb().db, 'blocks', user.uid));
        const uids = d.exists() ? (d.data() as { uids?: unknown }).uids : [];
        return Array.isArray(uids) ? uids.filter((x): x is string => typeof x === 'string') : [];
      }),
    setBlocked: (uid, blocked) =>
      guard(async () => {
        const user = me();
        const current = await service.blocked();
        const next = blocked ? [...new Set([...current, uid])] : current.filter((x) => x !== uid);
        await setDoc(doc(fb().db, 'blocks', user.uid), { uids: next.slice(0, 1000) });
      }),
  };
  return service;
}
