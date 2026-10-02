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
import { CREW_MAX, CREW_NOTE_MAX, CREW_PICKS_MAX, CREW_STAGE_MAX, type Activity, type Comment, type Crew, type CrewPicks, type CrewUpdate, type Profile } from '../models';
import { SocialError, MAX_SHARE_BYTES, type SocialService } from '../service';
import { cleanComment, cleanCrewName, cleanProfileInput, commentProblem, crewNameProblem, handleProblem, normalizeHandle, profileProblems } from '../validate';
import { asSocialError, commentFromDoc, crewFromDoc, crewPicksFromDoc, crewUpdateFromDoc, memoryFromDoc, prefixEnd, profileFromDoc, videoType } from './mapping';

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
 *   profiles/{uid}      handle, displayName, nameLower, bio, avatarUrl, festivals, sounds, createdAt, updatedAt
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

  const service: SocialService = {
    availability: () => (firebaseConfigured(config) ? { ok: true } : { ok: false, reason: 'not-set-up' }),

    onAuthChange(listener) {
      if (!firebaseConfigured(config)) {
        listener(null);
        return () => {};
      }
      return onAuthStateChanged(fb().auth, (u) => listener(u ? { uid: u.uid, email: u.email ?? undefined } : null));
    },
    signUp: (email, password) =>
      guard(async () => {
        const c = await createUserWithEmailAndPassword(fb().auth, email.trim(), password);
        return { uid: c.user.uid, email: c.user.email ?? undefined };
      }),
    signIn: (email, password) =>
      guard(async () => {
        const c = await signInWithEmailAndPassword(fb().auth, email.trim(), password);
        return { uid: c.user.uid, email: c.user.email ?? undefined };
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
        ]);
        const refs = snaps.flatMap((snap) => snap.docs.map((d) => d.ref));
        for (let i = 0; i < refs.length; i += 400) {
          const b = writeBatch(db);
          for (const r of refs.slice(i, i + 400)) b.delete(r);
          await b.commit();
        }
        const profile = await getDoc(doc(db, 'profiles', user.uid));
        const batch = writeBatch(db);
        const handle = profile.exists() ? (profile.data() as { handle?: string }).handle : undefined;
        if (handle) batch.delete(doc(db, 'handles', handle));
        batch.delete(doc(db, 'profiles', user.uid));
        batch.delete(doc(db, 'blocks', user.uid));
        await batch.commit();
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
        return runTransaction(db, async (tx) => {
          const current = profileFromDoc(user.uid, (await tx.get(profileRef)).data());
          const handleRef = doc(db, 'handles', input.handle);
          const owner = await tx.get(handleRef);
          if (owner.exists() && (owner.data() as { uid?: string }).uid !== user.uid) throw new SocialError('handle-taken');
          if (current && current.handle !== input.handle) tx.delete(doc(db, 'handles', current.handle));
          if (!owner.exists()) tx.set(handleRef, { uid: user.uid });
          const at = now();
          const next: Profile = {
            uid: user.uid,
            handle: input.handle,
            displayName: input.displayName,
            bio: input.bio,
            avatarUrl: current?.avatarUrl,
            festivals: input.showFestivals ? published.festivals.slice(0, 50) : [],
            sounds: input.showSound ? published.sounds.slice(0, 3) : [],
            showFestivals: input.showFestivals,
            showSound: input.showSound,
            createdAt: current?.createdAt || at,
            updatedAt: at,
          };
          const { uid: _uid, avatarUrl, ...fields } = next;
          tx.set(profileRef, { ...fields, nameLower: next.displayName.toLowerCase(), ...(avatarUrl ? { avatarUrl } : {}) });
          return next;
        });
      }),
    setAvatar: (uri) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        const path = `avatars/${user.uid}.jpg`;
        const avatarUrl = uri ? await upload(path, uri, 'image/jpeg') : undefined;
        if (!uri) await removeFile(path);
        const profileRef = doc(db, 'profiles', user.uid);
        const current = profileFromDoc(user.uid, (await getDoc(profileRef)).data());
        if (!current) throw new SocialError('no-profile');
        const updatedAt = now();
        const { uid: _uid, avatarUrl: _old, ...fields } = current;
        await setDoc(profileRef, { ...fields, nameLower: current.displayName.toLowerCase(), updatedAt, ...(avatarUrl ? { avatarUrl } : {}) });
        return { ...current, avatarUrl, updatedAt };
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
            capturedAt: input.capturedAt,
            ...(input.durationSec ? { durationSec: input.durationSec } : {}),
            ...(input.width && input.height ? { width: input.width, height: input.height } : {}),
            createdAt: now(),
          };
          await setDoc(memRef, shared);
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
        const data = d.data() as { uid?: string; videoPath?: string; thumbPath?: string };
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
        await deleteDoc(memRef);
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
        const snap = await getDocs(query(collection(fb().db, 'memories'), where('festivalId', '==', festivalId), orderBy('createdAt', 'desc'), limit(max)));
        return snap.docs.map((d) => memoryFromDoc(d.id, d.data())).filter((m): m is NonNullable<typeof m> => !!m);
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
        });
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
          // The last one out: everyone's updates and picks, then the crew.
          await removeUpdates(id);
          const all = await getDocs(collection(db, 'crews', id, 'picks'));
          const b = writeBatch(db);
          for (const d of all.docs) b.delete(d.ref);
          b.delete(crewRef);
          await b.commit();
          return;
        }
        // Your updates and picks go with you.
        await removeUpdates(id, user.uid).catch(() => {});
        await deleteDoc(doc(db, 'crews', id, 'picks', user.uid));
        await updateDoc(crewRef, { members, owner: c.owner === user.uid ? members[0] : c.owner });
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
