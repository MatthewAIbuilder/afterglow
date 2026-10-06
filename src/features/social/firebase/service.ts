import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { createUserWithEmailAndPassword, deleteUser, EmailAuthProvider, getAuth, initializeAuth, onAuthStateChanged, reauthenticateWithCredential, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type Auth, type Persistence } from 'firebase/auth';
import { collection, deleteDoc, deleteField, doc, getCountFromServer, getDoc, getDocs, initializeFirestore, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, startAfter, Timestamp, updateDoc, where, writeBatch, type DocumentData, type DocumentReference, type Firestore, type Query } from 'firebase/firestore';
import { Platform } from 'react-native';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytesResumable, type FirebaseStorage } from 'firebase/storage';
import type { FIREBASE_CONFIG } from '../../../config/social';
import { firebaseConfigured } from '../../../config/social';
import { ARTISTS_SHOWN, CHAT_MAX, CHAT_SEND_TIMEOUT_MS, type CrewMessage, CREW_MAX, CREW_NOTE_MAX, CREW_PICKS_MAX, CREW_STAGE_MAX, DROP_FILE_MAX, FOUNDERS_MAX, SUPPORT_MAX, type Activity, type ClipComment, type Comment, validClipId, type Crew, type CrewInvite, type CrewPicks, type CrewUpdate, MEET_SPOT_MAX, type Profile, DM_PREFIX, directRoom, isDirectRoom, SUPPORT_REPLIES_MAX, type ReportRecord, TIP_TEXT_MAX, VIDEO_TAGS_MAX, type VideoTag } from '../models';
import { SocialError, MAX_SHARE_BYTES, type SocialService } from '../service';
import { cleanComment, cleanCrewName, cleanProfileInput, commentProblem, crewNameProblem, handleProblem, normalizeHandle, profileProblems } from '../validate';
import { throwbackShares } from '../../memories/throwbackLimit';
import { FIND_GRACE_DAYS } from '../../finds/finds';
import { nextPresence, presenceFromDoc } from '../../admin/presence';
import { cleanBackdrop } from '../../profile/backdrops';
import { GIFT_THEME_IDS } from '../../themes/gifts';
import { cleanPublicGarden, PUBLIC_GARDEN_MAX } from '../../sprouts/publicGarden';
import { cleanArtistName } from '../../../data/extraArtists';
import { profileToDoc, asSocialError, dropFromDoc, patchFromDoc, privilegesFrom, commentFromDoc, clipCommentFromDoc, crewFromDoc, crewInviteFromDoc, crewMessageFromDoc, crewPicksFromDoc, crewUpdateFromDoc, meetSpotFromDoc, memoryFromDoc, prefixEnd, profileFromDoc, reportFromDoc, standingFromDocs, supportFromDoc, videoType, accountFindFromDoc, sproutFromDoc, stickerFromDoc, huntFromDoc, setTimesTipFromDoc, videoTagFromDoc } from './mapping';


/** Where a chat room lives: a crew, or a 1-to-1 chat (`dm_<a>_<b>` is `dms/<a>_<b>`). */
const room = (id: string): [string, string] => (isDirectRoom(id) ? ['dms', id.slice(DM_PREFIX.length)] : ['crews', id]);

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
 *   clipComments/{id}   clipId, uid, handle, text (≤ 300), createdAt (server time): comments on clips in Discover, removed by you or support
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
  /** A Firestore time (or ISO string) as ISO; undefined when missing. */
  const readTime = (v: unknown): string | undefined => {
    if (typeof v === 'string') return v;
    const t = v as { toDate?: () => Date } | null;
    return t?.toDate ? t.toDate().toISOString() : undefined;
  };
  /** Sending set times (perhaps with a screenshot) gives up after this long with no signal. */
  const SET_TIMES_SEND_TIMEOUT_MS = 20_000;
  /** A write that hasn't got through by `ms` counts as no signal (Firestore keeps trying it in the background). */
  const withTimeout = <T,>(p: Promise<T>, ms: number) =>
    new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new SocialError('network')), ms);
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e);
        },
      );
    });

  /** A read with no answer by then counts as no signal, so nothing waits forever on festival signal. */
  const READ_TIMEOUT_MS = 12_000;
  /**
   * A query read from the server. With no signal Firestore answers from its
   * memory instead (empty on a fresh start), which would look like "you have
   * no crews": that counts as no signal, so the app shows what it kept.
   */
  const serverDocs = async (q: Query<DocumentData>) => {
    const snap = await withTimeout(getDocs(q), READ_TIMEOUT_MS);
    if (snap.metadata.fromCache) throw new SocialError('network');
    return snap;
  };
  /** A document read that gives up after READ_TIMEOUT_MS (Firestore already fails one it can't reach). */
  const readDoc = (r: DocumentReference<DocumentData>) => withTimeout(getDoc(r), READ_TIMEOUT_MS);
  /** Snapshots made from an empty memory with no signal say nothing yet: they're skipped, so what was kept stays. */
  const nothingYet = (snap: { empty: boolean; metadata: { fromCache: boolean } }) => snap.empty && snap.metadata.fromCache;

  async function upload(path: string, uri: string | Blob, contentType: string, onProgress?: (s: number) => void) {
    const blob = typeof uri === 'string' ? await (await fetch(uri)).blob() : uri;
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
  /** Remove a file, where only "it's already gone" counts as done; anything else (no signal) throws. */
  const removeFileStrict = async (path: string | undefined) => {
    if (!path) return;
    try {
      await deleteObject(ref(fb().storage, path));
    } catch (e) {
      if ((e as { code?: unknown } | null)?.code !== 'storage/object-not-found') throw e;
    }
  };
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

  /** A crew's chat messages (or one member's), removed as well as the database allows. */
  async function removeChat(crewId: string, uid?: string) {
    const col = collection(fb().db, 'crews', crewId, 'chat');
    const snap = await getDocs(uid ? query(col, where('uid', '==', uid)) : col);
    for (const d of snap.docs) await deleteDoc(d.ref).catch(() => {});
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
    await removeChat(id).catch(() => {});
    const reads = await getDocs(collection(db, 'crews', id, 'reads')).catch(() => null);
    for (const d of reads?.docs ?? []) await deleteDoc(d.ref).catch(() => {});
    await deleteDoc(doc(db, 'crews', id, 'meta', 'meet')).catch(() => {});
    await deleteDoc(doc(db, 'crews', id, 'meta', 'invite')).catch(() => {});
    const joins = await getDocs(collection(db, 'crews', id, 'joins')).catch(() => null);
    for (const d of joins?.docs ?? []) await deleteDoc(d.ref).catch(() => {});
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
        // Your 1-to-1 messages and read marks go too (the other person keeps theirs).
        const rooms = await getDocs(query(collection(db, 'dms'), where('members', 'array-contains', user.uid))).catch(() => null);
        for (const r of rooms?.docs ?? []) {
          const said = await getDocs(query(collection(r.ref, 'chat'), where('uid', '==', user.uid), limit(500))).catch(() => null);
          for (const d of said?.docs ?? []) await deleteDoc(d.ref).catch(() => {});
          await deleteDoc(doc(r.ref, 'reads', user.uid)).catch(() => {});
        }
        // Follows and likes either way.
        const snaps = await Promise.all([
          getDocs(query(collection(db, 'follows'), where('from', '==', user.uid))),
          getDocs(query(collection(db, 'follows'), where('to', '==', user.uid))),
          getDocs(query(collection(db, 'likes'), where('uid', '==', user.uid))),
          getDocs(query(collection(db, 'likes'), where('owner', '==', user.uid))),
          getDocs(query(collection(db, 'comments'), where('uid', '==', user.uid))),
          getDocs(query(collection(db, 'comments'), where('owner', '==', user.uid))),
          // Comments on clips in Discover (soft: a database whose rules predate them never blocks deleting the account).
          getDocs(query(collection(db, 'clipComments'), where('uid', '==', user.uid))).catch(() => ({ docs: [] as { ref: DocumentReference }[] })),
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
        // Stickers you found go too.
        const finds = await getDocs(query(collection(db, 'finds'), where('uid', '==', user.uid), limit(500))).catch(() => null);
        for (const d of finds?.docs ?? []) await deleteDoc(d.ref).catch(() => {});
        // Set times you sent, screenshots and all.
        const tips = await getDocs(query(collection(db, 'setTimes'), where('uid', '==', user.uid), limit(200))).catch(() => null);
        for (const d of tips?.docs ?? []) await deleteDoc(d.ref).catch(() => {});
        // Your messages to support, and their replies.
        const asked = await getDocs(query(collection(db, 'support'), where('uid', '==', user.uid), limit(500))).catch(() => null);
        for (const d of asked?.docs ?? []) await deleteDoc(d.ref).catch(() => {});
        // Your garden as shown on your profile.
        await deleteDoc(doc(db, 'gardens', user.uid)).catch(() => {});
        // Gift themes you were given.
        for (const theme of GIFT_THEME_IDS) await deleteDoc(doc(db, 'themeGrants', `${user.uid}_${theme}`)).catch(() => {});
        // Sprouts you gave and picked up go too (the rules allow it once the profile is gone).
        for (const field of ['from', 'to'] as const) {
          const snap = await getDocs(query(collection(db, 'sprouts'), where(field, '==', user.uid), limit(500))).catch(() => null);
          for (const d of snap?.docs ?? []) await deleteDoc(d.ref).catch(() => {});
        }
        await deleteUser(user);
      }),

    profileOf: (uid) => guard(async () => profileFromDoc(uid, (await readDoc(doc(fb().db, 'profiles', uid))).data())),
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
            // Left out of the input: keep the ones you have.
            const socials = input.socials ?? current?.socials;
            const next: Profile = {
              uid: user.uid,
              handle: input.handle,
              displayName: input.displayName,
              bio: input.bio,
              avatarUrl: current?.avatarUrl,
              coverUrl: current?.coverUrl,
              festivals: input.showFestivals ? published.festivals.slice(0, 50) : [],
              // Shows you're going to go with your festivals (left as they were when not given).
              shows: input.showFestivals ? (published.shows ?? current?.shows ?? []).slice(0, 30) : [],
              sounds: input.showSound ? published.sounds.slice(0, 3) : [],
              artists: showArtists ? (published.artists ?? current?.artists ?? []).slice(0, ARTISTS_SHOWN) : [],
              showFestivals: input.showFestivals,
              showSound: input.showSound,
              showArtists,
              backdrop: current?.backdrop,
              ...(socials && Object.keys(socials).length ? { socials } : {}),
              createdAt: current?.createdAt || at,
              updatedAt: at,
            };
            tx.set(profileRef, profileToDoc(next, legacy));
            // On the older rules your socials weren't saved: say so by leaving them off what comes back.
            if (legacy && next.socials) {
              const { socials: _left, ...rest } = next;
              return rest;
            }
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
        const thumbPath = input.thumbUri ? `memories/${user.uid}/${memRef.id}.jpg` : undefined;
        // A throwback is counted: a few free and as many as you like with Plus. Checked before anything
        // uploads, so a share past the limit never sends a whole video for nothing (the rules hold the same line).
        const throwback = !input.festivalId && !!input.past;
        const usageRef = doc(db, 'usage', user.uid);
        let used = 0;
        let plus = false;
        if (throwback) {
          used = Number((await getDoc(usageRef)).data()?.throwbacks) || 0;
          plus = !!standingFromDocs(undefined, undefined, (await getDoc(doc(db, 'plus', user.uid)).catch(() => undefined))?.data()).plus;
          if (!throwbackShares({ plus, used }).canShare) throw new SocialError('throwback-limit');
        }
        // The file's type decides its name (a video chosen on the website has no name of its own: an iPhone's
        // .mov says video/quicktime), so storage.rules and the player both see what it really is.
        const video = await (await fetch(input.videoUri)).blob();
        const contentType = videoType(input.videoUri, video.type);
        const ext = contentType === 'video/quicktime' ? 'mov' : contentType === 'video/x-m4v' ? 'm4v' : 'mp4';
        const videoPath = `memories/${user.uid}/${memRef.id}.${ext}`;
        try {
          const videoUrl = await upload(videoPath, video, contentType, (s) => onProgress?.(s * 0.95));
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
            ...(input.artistId && input.withArtistIds?.length ? { withArtistIds: input.withArtistIds.slice(0, 3) } : {}),
            ...(input.artistId && cleanArtistName(input.artistName) ? { artistName: cleanArtistName(input.artistName) } : {}),
            // A past festival: its name, year, town and the same festival on Afterglow, as plain fields.
            ...(!input.festivalId && input.past
              ? {
                  pastName: input.past.name,
                  pastYear: input.past.year,
                  ...(input.past.city ? { pastCity: input.past.city } : {}),
                  ...(input.past.seriesId ? { seriesId: input.past.seriesId } : {}),
                }
              : {}),
            // A one-night show: its name, day, town and the show on Afterglow, as plain fields.
            ...(!input.festivalId && !input.past && input.show
              ? {
                  showName: input.show.name,
                  showDate: input.show.date,
                  ...(input.show.city ? { showCity: input.show.city } : {}),
                  ...(input.show.showId ? { showId: input.show.showId } : {}),
                }
              : {}),
            // A trimmed video: the part that plays.
            ...(input.clip ? { clipStart: input.clip.start, clipEnd: input.clip.end } : {}),
            capturedAt: input.capturedAt,
            ...(input.durationSec ? { durationSec: input.durationSec } : {}),
            ...(input.width && input.height ? { width: input.width, height: input.height } : {}),
            createdAt: now(),
          };
          if (throwback) {
            // The memory and the count move together (read again, in case another phone shared one meanwhile).
            used = Number((await getDoc(usageRef)).data()?.throwbacks) || 0;
            if (!throwbackShares({ plus, used }).canShare) throw new SocialError('throwback-limit');
            const b = writeBatch(db);
            b.set(memRef, shared);
            b.set(usageRef, { throwbacks: used + 1, memory: memRef.id });
            await b.commit();
          } else await setDoc(memRef, shared);
          onProgress?.(1);
          // People in it are asked (best effort: the video is shared either way).
          if (input.people?.length) {
            const b = writeBatch(db);
            for (const uid of [...new Set(input.people)].filter((u) => u !== user.uid).slice(0, VIDEO_TAGS_MAX))
              b.set(doc(db, 'videoTags', `${memRef.id}_${uid}`), { memoryId: memRef.id, owner: user.uid, uid, status: 'approved', createdAt: now() });
            await b.commit().catch(() => {});
          }
          return memoryFromDoc(memRef.id, shared)!;
        } catch (e) {
          // Nothing half-shared: files that made it up are removed again.
          await removeFile(videoPath);
          await removeFile(thumbPath);
          throw e;
        }
      }),
    retagShared: (id, tags) =>
      guard(async () => {
        const user = me();
        const ref = doc(fb().db, 'memories', id);
        const before = memoryFromDoc(id, (await getDoc(ref)).data());
        if (!before || before.uid !== user.uid) throw new SocialError('not-signed-in');
        // A throwback stays one, and nothing else becomes one (the free plan counts them as they're shared).
        const wasThrowback = !before.festivalId && !!before.past;
        const past = wasThrowback ? (tags.past ?? before.past) : undefined;
        const festivalId = wasThrowback ? undefined : tags.festivalId;
        const show = festivalId || past ? undefined : tags.show;
        const withArtistIds = tags.artistId ? tags.withArtistIds?.slice(0, 3) : undefined;
        const set = <T,>(v: T | undefined) => (v === undefined || v === '' ? deleteField() : v);
        await updateDoc(ref, {
          festivalId: set(festivalId),
          night: set(festivalId ? tags.night : undefined),
          artistId: set(tags.artistId),
          withArtistIds: set(withArtistIds?.length ? withArtistIds : undefined),
          artistName: set(tags.artistId ? cleanArtistName(tags.artistName) : undefined),
          pastName: set(past?.name),
          pastYear: set(past?.year),
          pastCity: set(past?.city),
          seriesId: set(past?.seriesId),
          showName: set(show?.name),
          showDate: set(show?.date),
          showCity: set(show?.city),
          showId: set(show?.showId),
        });
        return memoryFromDoc(id, (await getDoc(ref)).data())!;
      }),
    videoTags: (memoryId) =>
      guard(async () => {
        const user = me();
        const tags = collection(fb().db, 'videoTags');
        const [said, mine] = await Promise.all([
          getDocs(query(tags, where('memoryId', '==', memoryId), where('status', '==', 'approved'))),
          // The video's owner also sees who hasn't answered yet.
          getDocs(query(tags, where('memoryId', '==', memoryId), where('owner', '==', user.uid))).catch(() => undefined),
        ]);
        const byId = new Map<string, VideoTag>();
        for (const d of [...said.docs, ...(mine?.docs ?? [])]) {
          const tag = videoTagFromDoc(d.id, d.data());
          if (tag) byId.set(tag.id, tag);
        }
        return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      }),
    setVideoTags: (memoryId, uids) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        const want = [...new Set(uids.filter((u) => u && u !== user.uid))].slice(0, VIDEO_TAGS_MAX);
        const now_ = await getDocs(query(collection(db, 'videoTags'), where('memoryId', '==', memoryId), where('owner', '==', user.uid)));
        const have = new Set(now_.docs.map((d) => String(d.data().uid)));
        const b = writeBatch(db);
        for (const d of now_.docs) if (!want.includes(String(d.data().uid))) b.delete(d.ref);
        for (const uid of want)
          if (!have.has(uid)) b.set(doc(db, 'videoTags', `${memoryId}_${uid}`), { memoryId, owner: user.uid, uid, status: 'approved', createdAt: now() });
        await b.commit();
      }),
    answerVideoTag: (memoryId, yes) =>
      guard(async () => {
        const ref = doc(fb().db, 'videoTags', `${memoryId}_${me().uid}`);
        if (yes) await updateDoc(ref, { status: 'approved' });
        else await deleteDoc(ref);
      }),
    taggedMemoriesOf: (uid) =>
      guard(async () => {
        const { db } = fb();
        const tags = await getDocs(query(collection(db, 'videoTags'), where('uid', '==', uid), where('status', '==', 'approved'), limit(60)));
        const memories = await Promise.all(tags.docs.map(async (d) => memoryFromDoc(String(d.data().memoryId), (await getDoc(doc(db, 'memories', String(d.data().memoryId))).catch(() => undefined))?.data())));
        return memories.filter((m): m is NonNullable<typeof m> => !!m).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
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
        // So do its people tags (best effort: without the video they show nowhere).
        const tagged = await getDocs(query(collection(fb().db, 'videoTags'), where('memoryId', '==', id), where('owner', '==', user.uid))).catch(() => undefined);
        for (const d of tagged?.docs ?? []) await deleteDoc(d.ref).catch(() => {});
        // The files go first, and must really go (a missing one counts as gone): a file is never left
        // reachable once its doc is gone. If this stops part way, the doc is still there to try again from.
        await removeFileStrict(data.videoPath);
        await removeFileStrict(data.thumbPath);
        if (data.pastName) {
          // A throwback gives its place back.
          const usageRef = doc(fb().db, 'usage', user.uid);
          const used = Number((await getDoc(usageRef)).data()?.throwbacks) || 0;
          const b = writeBatch(fb().db);
          b.delete(memRef);
          if (used > 0) b.set(usageRef, { throwbacks: used - 1, memory: id });
          await b.commit();
        } else await deleteDoc(memRef);
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
    artistMemories: (artistId, max) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'memories'), where('artistId', '==', artistId), orderBy('createdAt', 'desc'), limit(max))).catch((e: unknown) => {
          // A database without the index yet just has none to show; anything else (no signal) is an error, so it's tried again.
          if ((e as { code?: string })?.code === 'failed-precondition') return undefined;
          throw e;
        });
        return (snap?.docs ?? []).map((d) => memoryFromDoc(d.id, d.data())).filter((m): m is NonNullable<typeof m> => !!m);
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
          // Exactly your sign-in email and your profile's handle (the rules check both).
          ...(user.email ? { email: user.email } : {}),
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
        const ref_ = doc(fb().db, 'support', id);
        const was = supportFromDoc(id, (await getDoc(ref_)).data());
        const text = reply.trim().slice(0, 2000);
        const at = now();
        // Every reply is kept (a second one never replaces the first); `reply` stays the latest for older apps.
        const replies = [...(was?.replies ?? []).map((r) => ({ text: r.text, ...(r.at ? { at: r.at } : {}) })), { text, at }].slice(-SUPPORT_REPLIES_MAX);
        await updateDoc(ref_, { reply: text, repliedAt: at, replies, status: 'answered' });
      }),
    setSupportStatus: (id, status) => guard(async () => updateDoc(doc(fb().db, 'support', id), { status })),
    reports: (max) =>
      guard(async () => {
        const { db } = fb();
        // Every open report (so a flood of new or old ones can't hide one), and the newest of all (dealt with, and reports filed before they carried a status).
        const [open, newest] = await Promise.all([
          getDocs(query(collection(db, 'reports'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(max))).catch(() => null),
          getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(max))),
        ]);
        const byId = new Map<string, ReportRecord>();
        for (const d of [...(open?.docs ?? []), ...newest.docs]) {
          const r = reportFromDoc(d.id, d.data());
          if (r) byId.set(r.id, r);
        }
        return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }),
    resolveReport: (id) => guard(async () => updateDoc(doc(fb().db, 'reports', id), { status: 'resolved', resolvedAt: now() })),
    takeDown: (kind, id) =>
      guard(async () => {
        const { db } = fb();
        if (kind === 'comment') return deleteDoc(doc(db, 'comments', id));
        if (kind === 'clipComment') return deleteDoc(doc(db, 'clipComments', id));
        if (kind === 'chat') {
          const [crewId, messageId] = id.split('/');
          if (!crewId || !messageId) return;
          return deleteDoc(doc(db, ...room(crewId), 'chat', messageId));
        }
        const ref_ = doc(db, 'memories', id);
        const data = (await getDoc(ref_)).data() as { videoPath?: string; thumbPath?: string } | undefined;
        await removeFile(data?.videoPath);
        await removeFile(data?.thumbPath);
        await deleteDoc(ref_);
      }),
    reportedMessage: (target) =>
      guard(async () => {
        const [crewId, messageId] = target.split('/');
        if (!crewId || !messageId) return null;
        return crewMessageFromDoc(crewId, messageId, (await getDoc(doc(fb().db, ...room(crewId), 'chat', messageId))).data());
      }),
    reportedComment: (id) => guard(async () => commentFromDoc(id, (await getDoc(doc(fb().db, 'comments', id))).data())),
    reportedClipComment: (id) => guard(async () => clipCommentFromDoc(id, (await getDoc(doc(fb().db, 'clipComments', id))).data())),
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
    sendSetTimes: (festivalId, tip) =>
      guard(async () => {
        const user = me();
        const ref_ = doc(fb().db, 'setTimes', `${user.uid}_${festivalId}`);
        const text = tip.text?.trim().slice(0, TIP_TEXT_MAX);
        const data = { uid: user.uid, festivalId, status: 'new', createdAt: serverTimestamp(), ...(text ? { text } : {}), ...(tip.photo ? { photo: tip.photo } : {}) };
        // With no signal Firestore would wait for good; a screenshot gets a little longer than a chat message.
        const send = () => withTimeout(setDoc(ref_, data), SET_TIMES_SEND_TIMEOUT_MS);
        try {
          await send();
        } catch (e) {
          if (e instanceof SocialError) throw e;
          // One waiting per festival: the record is already there (and only HQ may change it)…
          const was = await getDoc(ref_).catch(() => null);
          if (!was?.exists()) throw e;
          if (was.data()?.status !== 'live') throw new SocialError('already-sent');
          // …unless the last one already went live: clear it and send this one.
          await deleteDoc(ref_);
          await send();
        }
      }),
    mySetTimes: () =>
      guard(async () => {
        const user = me();
        const snap = await getDocs(query(collection(fb().db, 'setTimes'), where('uid', '==', user.uid), limit(50)));
        return snap.docs.map((d) => setTimesTipFromDoc(d.id, d.data())).filter((x): x is NonNullable<typeof x> => !!x);
      }),
    setTimesTips: (max) =>
      guard(async () => {
        // Newest first, so old ones left waiting never crowd out what just came in.
        const snap = await getDocs(query(collection(fb().db, 'setTimes'), where('status', '==', 'new'), orderBy('createdAt', 'desc'), limit(max)));
        return snap.docs.map((d) => setTimesTipFromDoc(d.id, d.data())).filter((x): x is NonNullable<typeof x> => !!x);
      }),
    markSetTimesLive: (id) => guard(async () => updateDoc(doc(fb().db, 'setTimes', id), { status: 'live', photo: deleteField() })),
    declineSetTimes: (id) => guard(async () => deleteDoc(doc(fb().db, 'setTimes', id))),
    livePatches: () =>
      guard(async () => {
        // The newest 200 (so a new update always reaches phones), applied oldest first.
        // From the server only: an empty answer from memory with no signal would take every update off this phone.
        const snap = await serverDocs(query(collection(fb().db, 'published'), orderBy('publishedAt', 'desc'), limit(200)));
        return snap.docs
          .map((d) => patchFromDoc(d.id, d.data()))
          .filter((x): x is NonNullable<typeof x> => !!x)
          .reverse();
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
        const snap = await serverDocs(query(collection(fb().db, 'follows'), where('from', '==', uid), orderBy('createdAt', 'desc'), limit(max)));
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
    clipComment: (clipId, raw) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        if (!validClipId(clipId) || commentProblem(raw)) throw new SocialError('unknown');
        const profile = profileFromDoc(user.uid, (await getDoc(doc(db, 'profiles', user.uid))).data());
        if (!profile) throw new SocialError('no-profile');
        const ref_ = doc(collection(db, 'clipComments'));
        const data = { clipId, uid: user.uid, handle: profile.handle, text: cleanComment(raw) };
        // Stamped with the server's time (the rules require it), so no phone clock can reorder them.
        await setDoc(ref_, { ...data, createdAt: serverTimestamp() });
        return { id: ref_.id, ...data, createdAt: now() };
      }),
    clipComments: (clipId, max, after) =>
      guard(async () => {
        const { db } = fb();
        const list = collection(db, 'clipComments');
        // The next page starts after the last one already read (its own document, so ties in time can't skip one).
        const last = after ? await getDoc(doc(db, 'clipComments', after.id)) : undefined;
        const q =
          last && last.exists()
            ? query(list, where('clipId', '==', clipId), orderBy('createdAt', 'asc'), startAfter(last), limit(max))
            : query(list, where('clipId', '==', clipId), orderBy('createdAt', 'asc'), ...(after ? [startAfter(Timestamp.fromMillis(Date.parse(after.createdAt)))] : []), limit(max));
        const snap = await getDocs(q);
        return snap.docs.map((d) => clipCommentFromDoc(d.id, d.data())).filter((c): c is ClipComment => !!c && c.id !== after?.id);
      }),
    clipCommentCount: (clipId) =>
      guard(async () => (await getCountFromServer(query(collection(fb().db, 'clipComments'), where('clipId', '==', clipId)))).data().count),
    deleteClipComment: (id) => guard(async () => deleteDoc(doc(fb().db, 'clipComments', id))),
    activity: (max) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        const [followed, liked, said, tagged] = await Promise.all([
          getDocs(query(collection(db, 'follows'), where('to', '==', user.uid), orderBy('createdAt', 'desc'), limit(max))),
          getDocs(query(collection(db, 'likes'), where('owner', '==', user.uid), orderBy('createdAt', 'desc'), limit(max))),
          getDocs(query(collection(db, 'comments'), where('owner', '==', user.uid), orderBy('createdAt', 'desc'), limit(max))),
          // Tagged in a video (on your profile straight away; tags from before that are said yes to here).
          getDocs(query(collection(db, 'videoTags'), where('uid', '==', user.uid), limit(max))).catch(() => undefined),
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
        for (const d of tagged?.docs ?? []) {
          const tag = videoTagFromDoc(d.id, d.data());
          if (!tag) continue;
          items.push({ kind: 'tag', id: tag.id, from: tag.owner, memoryId: tag.memoryId, createdAt: tag.createdAt });
          // A tag from before tags showed straight away: it shows now (you can still hide it).
          if (tag.status === 'pending') void updateDoc(d.ref, { status: 'approved' }).catch(() => {});
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
        // Starting a crew means agreeing to the chat rules too.
        await setDoc(doc(fb().db, 'crews', crewRef.id, 'joins', user.uid), { agreed: true, at: serverTimestamp() }).catch(() => {});
        return { id: crewRef.id, ...data };
      }),
    crew: (id) => guard(async () => crewFromDoc(id, (await readDoc(doc(fb().db, 'crews', id))).data())),
    myCrews: () =>
      guard(async () => {
        const user = me();
        const snap = await serverDocs(query(collection(fb().db, 'crews'), where('members', 'array-contains', user.uid), limit(50)));
        return snap.docs.map((d) => crewFromDoc(d.id, d.data())).filter((c): c is Crew => !!c);
      }),
    joinCrew: (id, code) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        const invited = (await getDoc(doc(db, 'crewInvites', `${id}_${user.uid}`)).catch(() => null))?.exists() ?? false;
        const cleanCode = code && /^[A-Za-z0-9]{12,40}$/.test(code) ? code : undefined;
        const c = await runTransaction(db, async (tx) => {
          const crewRef = doc(db, 'crews', id);
          const c = crewFromDoc(id, (await tx.get(crewRef)).data());
          if (!c) throw new SocialError('not-found');
          if (c.members.includes(user.uid)) return c;
          if (!invited && !cleanCode) throw new SocialError('not-invited');
          if (c.members.length >= CREW_MAX) throw new SocialError('crew-full');
          const members = [...c.members, user.uid];
          // How you got in, and that you agreed to the chat rules: the database checks both.
          tx.set(doc(db, 'crews', id, 'joins', user.uid), { agreed: true, at: serverTimestamp(), ...(cleanCode && !invited ? { code: cleanCode } : {}) });
          tx.update(crewRef, { members });
          return { ...c, members };
        }).catch((e: unknown) => {
          // Refused with a link: its code is old or wrong.
          if (!invited && (e as { code?: string })?.code === 'permission-denied') throw new SocialError('not-invited');
          throw e;
        });
        // An invite to it is done with.
        await deleteDoc(doc(db, 'crewInvites', `${id}_${user.uid}`)).catch(() => {});
        return c;
      }),
    crewInviteCode: (crewId) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        const ref_ = doc(db, 'crews', crewId, 'meta', 'invite');
        const code = (await getDoc(ref_)).data()?.code;
        if (typeof code === 'string' && code) return code;
        const fresh = doc(collection(db, 'crews')).id;
        await setDoc(ref_, { code: fresh, by: user.uid, at: serverTimestamp() });
        return fresh;
      }),
    newCrewInviteCode: (crewId) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        const fresh = doc(collection(db, 'crews')).id;
        await setDoc(doc(db, 'crews', crewId, 'meta', 'invite'), { code: fresh, by: user.uid, at: serverTimestamp() });
        return fresh;
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
        const snap = await serverDocs(query(collection(fb().db, 'crewInvites'), where('to', '==', user.uid), orderBy('createdAt', 'desc'), limit(max)));
        return snap.docs.map((d) => crewInviteFromDoc(d.id, d.data())).filter((i): i is CrewInvite => !!i);
      }),
    sentCrewInvites: (crewId) =>
      guard(async () => {
        const user = me();
        const snap = await getDocs(query(collection(fb().db, 'crewInvites'), where('crewId', '==', crewId), where('from', '==', user.uid), limit(100)));
        return snap.docs.map((d) => crewInviteFromDoc(d.id, d.data())?.to).filter((u): u is string => !!u);
      }),
    giveSprout: (input) =>
      guard(async () => {
        const user = me();
        const ref = doc(fb().db, 'sprouts', input.id);
        try {
          await withTimeout(
            setDoc(ref, {
              from: user.uid,
              kind: input.kind,
              ...(input.note ? { note: input.note.slice(0, 60) } : {}),
              ...(input.festivalId ? { festivalId: input.festivalId } : {}),
              ...(input.artistId && input.artistName ? { artistId: input.artistId, artistName: input.artistName.slice(0, 60) } : {}),
              ...(input.theme ? { theme: input.theme } : {}),
              createdAt: serverTimestamp(),
            }),
            CHAT_SEND_TIMEOUT_MS,
          );
        } catch (e) {
          // Sent before and the answer was lost: writing again is refused, and it's already there.
          if (e instanceof SocialError && e.kind === 'network') throw e;
          const there = sproutFromDoc(input.id, (await getDoc(ref)).data());
          if (there?.from === user.uid) return;
          throw e;
        }
      }),
    claimSprout: (id) =>
      guard(async () => {
        const user = me();
        const ref = doc(fb().db, 'sprouts', id);
        const read = async () => sproutFromDoc(id, (await getDoc(ref)).data());
        const s = await read();
        if (!s) throw new SocialError('not-found');
        if (s.to === user.uid || s.from === user.uid) return s;
        if (s.to) throw new SocialError('sprout-taken');
        if (Date.now() - Date.parse(s.createdAt) > 30 * 86_400_000) throw new SocialError('sprout-gone');
        try {
          await updateDoc(ref, { to: user.uid, claimedAt: serverTimestamp() });
        } catch (e) {
          const again = await read().catch(() => undefined);
          if (again === null) throw new SocialError('not-found');
          if (again?.to === user.uid) return again;
          if (again?.to) throw new SocialError('sprout-taken');
          // Still there and nobody has it, but refused: the giver blocked you.
          if (again && asSocialError(e).kind !== 'network') throw new SocialError('sprout-gone');
          throw e;
        }
        return (await read()) ?? { ...s, to: user.uid, claimedAt: now() };
      }),
    sprout: (id) => guard(async () => sproutFromDoc(id, (await getDoc(doc(fb().db, 'sprouts', id))).data())),
    sproutsGiven: (max) =>
      guard(async () => {
        const user = me();
        const snap = await getDocs(query(collection(fb().db, 'sprouts'), where('from', '==', user.uid), orderBy('createdAt', 'desc'), limit(max)));
        return snap.docs.map((d) => sproutFromDoc(d.id, d.data())).filter((x): x is NonNullable<typeof x> => !!x);
      }),
    sproutsReceived: (max) =>
      guard(async () => {
        const user = me();
        const snap = await getDocs(query(collection(fb().db, 'sprouts'), where('to', '==', user.uid), orderBy('claimedAt', 'desc'), limit(max)));
        return snap.docs.map((d) => sproutFromDoc(d.id, d.data())).filter((x): x is NonNullable<typeof x> => !!x);
      }),
    publishGarden: (residents) =>
      guard(async () => {
        const user = me();
        const ref = doc(fb().db, 'gardens', user.uid);
        if (!residents) await deleteDoc(ref);
        else await setDoc(ref, { residents: residents.slice(0, PUBLIC_GARDEN_MAX), updatedAt: serverTimestamp() });
      }),
    gardenOf: (uid) =>
      guard(async () => {
        const d = await getDoc(doc(fb().db, 'gardens', uid));
        return d.exists() ? cleanPublicGarden((d.data() as { residents?: unknown }).residents) : null;
      }),
    grantTheme: (sproutId, theme) =>
      guard(async () => {
        const user = me();
        const ref = doc(fb().db, 'themeGrants', `${user.uid}_${theme}`);
        try {
          await setDoc(ref, { uid: user.uid, theme, sprout: sproutId, createdAt: serverTimestamp() });
        } catch (e) {
          // Already granted (from this sprout or another): nothing to do.
          if (asSocialError(e).kind !== 'network' && (await getDoc(ref).catch(() => null))?.exists()) return;
          throw e;
        }
      }),
    takeBackSprout: (id) =>
      guard(async () => {
        const user = me();
        const ref = doc(fb().db, 'sprouts', id);
        try {
          // Writes from this phone go in order, so a give still waiting for signal lands before this.
          await deleteDoc(ref);
        } catch (e) {
          const s = sproutFromDoc(id, (await getDoc(ref)).data());
          if (!s) return;
          if (s.to) throw new SocialError('sprout-taken');
          if (s.from !== user.uid) throw new SocialError('not-found');
          throw e;
        }
      }),
    sticker: (code) => guard(async () => stickerFromDoc(code, (await getDoc(doc(fb().db, 'stickers', code))).data())),
    hunt: (id) => guard(async () => huntFromDoc(id, (await getDoc(doc(fb().db, 'hunts', id))).data())),
    recordFind: (code, at) =>
      guard(async () => {
        const user = me();
        const ref_ = doc(fb().db, 'finds', `${user.uid}_${code}`);
        try {
          await withTimeout(setDoc(ref_, { uid: user.uid, code, at: Timestamp.fromMillis(at), createdAt: serverTimestamp() }), CHAT_SEND_TIMEOUT_MS);
        } catch (e) {
          if (e instanceof SocialError && e.kind === 'network') throw e;
          // Sent before and the answer was lost: it's already there.
          if ((await getDoc(ref_).catch(() => null))?.exists()) return;
          const s = stickerFromDoc(code, (await getDoc(doc(fb().db, 'stickers', code))).data());
          // Gone, or taken down before this scan (or too long ago to send now).
          if (!s || (s.takenDownAt !== undefined && (at > s.takenDownAt || Date.now() > s.takenDownAt + FIND_GRACE_DAYS * 86_400_000))) throw new SocialError('not-found');
          // Refused for being too late, or for some other reason (kept and tried again).
          if (s.until !== undefined && (at > s.until || Date.now() > s.until + FIND_GRACE_DAYS * 86_400_000)) throw new SocialError('sticker-ended');
          throw e;
        }
      }),
    addSticker: (input) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        const ref_ = doc(db, 'stickers', input.code);
        return runTransaction(db, async (tx) => {
          let slot: number | undefined;
          if (input.huntId) {
            const huntRef = doc(db, 'hunts', input.huntId);
            const h = huntFromDoc(input.huntId, (await tx.get(huntRef)).data());
            if (!h) throw new SocialError('not-found');
            slot = h.items.length;
            tx.update(huntRef, { items: [...h.items, { creature: input.creature, name: input.name.slice(0, 40) }] });
          }
          const data = {
            name: input.name.trim().slice(0, 40),
            creature: input.creature,
            ...(input.huntId && slot !== undefined ? { huntId: input.huntId, slot } : {}),
            ...(input.until !== undefined ? { until: Timestamp.fromMillis(input.until) } : {}),
            ...(input.festivalId ? { festivalId: input.festivalId } : {}),
            by: user.uid,
            createdAt: serverTimestamp(),
          };
          tx.set(ref_, data);
          return stickerFromDoc(input.code, { ...data, until: input.until, createdAt: Date.now() })!;
        });
      }),
    stickers: (max) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'stickers'), orderBy('createdAt', 'desc'), limit(max)));
        // Taken-down ones stay in the database (scans from before still count) but leave HQ's list.
        return snap.docs.map((d) => stickerFromDoc(d.id, d.data())).filter((x): x is NonNullable<typeof x> => !!x && x.takenDownAt === undefined);
      }),
    // Taking a sticker down marks its place in its hunt as gone, so the hunt can still be finished.
    // The sticker is marked taken down rather than deleted, so a scan made before (sent later, with no signal) still counts.
    deleteSticker: (code) =>
      guard(async () => {
        const { db } = fb();
        const ref_ = doc(db, 'stickers', code);
        await runTransaction(db, async (tx) => {
          const s = stickerFromDoc(code, (await tx.get(ref_)).data());
          if (s?.huntId && s.slot !== undefined) {
            const huntRef = doc(db, 'hunts', s.huntId);
            const h = huntFromDoc(s.huntId, (await tx.get(huntRef)).data());
            if (h && h.items[s.slot]) tx.update(huntRef, { items: h.items.map((it, i) => (i === s.slot ? { ...it, gone: true } : it)) });
          }
          if (s && s.takenDownAt === undefined) tx.update(ref_, { takenDown: true, takenDownAt: serverTimestamp() });
        });
      }),
    myFinds: (max) =>
      guard(async () => {
        const user = me();
        const snap = await getDocs(query(collection(fb().db, 'finds'), where('uid', '==', user.uid), limit(max)));
        return snap.docs.map((d) => accountFindFromDoc(d.data())).filter((x): x is NonNullable<typeof x> => !!x);
      }),
    addHunt: (input) =>
      guard(async () => {
        const user = me();
        const data = {
          name: input.name.trim().slice(0, 40),
          items: [],
          ...(input.until !== undefined ? { until: Timestamp.fromMillis(input.until) } : {}),
          ...(input.festivalId ? { festivalId: input.festivalId } : {}),
          by: user.uid,
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(fb().db, 'hunts', input.id), data);
        return huntFromDoc(input.id, { ...data, until: input.until })!;
      }),
    hunts: (max) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'hunts'), orderBy('createdAt', 'desc'), limit(max)));
        return snap.docs.map((d) => huntFromDoc(d.id, d.data())).filter((x): x is NonNullable<typeof x> => !!x);
      }),
    deleteHunt: (id) => guard(async () => deleteDoc(doc(fb().db, 'hunts', id))),
    stickerFinds: (code) => guard(async () => (await getCountFromServer(query(collection(fb().db, 'finds'), where('code', '==', code)))).data().count),
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
        // Your updates, messages and picks go with you.
        await removeUpdates(id, user.uid).catch(() => {});
        await removeChat(id, user.uid).catch(() => {});
        await deleteDoc(doc(db, 'crews', id, 'reads', user.uid)).catch(() => {});
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
        await removeChat(id, uid).catch(() => {});
        await deleteDoc(doc(db, 'crews', id, 'reads', uid)).catch(() => {});
        await deleteDoc(doc(db, 'crews', id, 'picks', uid));
        const members = c.members.filter((m) => m !== uid);
        await updateDoc(crewRef, { members });
        // The invite link they came in with stops working, so they can't come straight back.
        await setDoc(doc(db, 'crews', id, 'meta', 'invite'), { code: doc(collection(db, 'crews')).id, by: me().uid, at: serverTimestamp() }).catch(() => {});
        await deleteDoc(doc(db, 'crews', id, 'joins', uid)).catch(() => {});
        return { ...c, members };
      }),
    setCrewPicks: (id, artists) =>
      guard(async () => {
        const user = me();
        await setDoc(doc(fb().db, 'crews', id, 'picks', user.uid), { artists: [...new Set(artists)].slice(0, CREW_PICKS_MAX), updatedAt: now() });
      }),
    crewPicks: (id) =>
      guard(async () => {
        const snap = await serverDocs(collection(fb().db, 'crews', id, 'picks'));
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
        const snap = await serverDocs(
          query(collection(fb().db, 'crews', crewId, 'updates'), where('atMs', '>=', sinceMs), orderBy('atMs', 'desc'), limit(max)),
        );
        return snap.docs.map((d) => crewUpdateFromDoc(crewId, d.id, d.data())).filter((u): u is CrewUpdate => !!u);
      }),
    sendCrewMessages: (crewId, inputs) =>
      guard(async () => {
        const user = me();
        const { db } = fb();
        const ready = inputs
          .map((i) => ({ id: i.id, text: i.text.trim().slice(0, CHAT_MAX), atMs: Date.parse(i.at) }))
          .filter((i) => i.text && Number.isFinite(i.atMs));
        if (!ready.length) return [];
        // One write for all of them: the least a weak connection has to carry.
        const batch = writeBatch(db);
        for (const i of ready) batch.set(doc(db, ...room(crewId), 'chat', i.id), { uid: user.uid, text: i.text, atMs: i.atMs, sentAt: serverTimestamp() });
        try {
          await withTimeout(batch.commit(), CHAT_SEND_TIMEOUT_MS);
          return ready.map((i) => i.id);
        } catch (e) {
          if ((e as { code?: string })?.code !== 'permission-denied') throw e;
          // A message from an earlier try that did get through can't be written again: see which are there.
          const there = await Promise.all(ready.map(async (i) => ((await getDoc(doc(db, ...room(crewId), 'chat', i.id))).exists() ? i.id : null)));
          const done = there.filter((x): x is string => !!x);
          if (!done.length) throw e;
          // The rest were refused only because they came with those: send them on their own.
          const rest = ready.filter((i) => !done.includes(i.id));
          if (rest.length) {
            const again = writeBatch(db);
            for (const i of rest) again.set(doc(db, ...room(crewId), 'chat', i.id), { uid: user.uid, text: i.text, atMs: i.atMs, sentAt: serverTimestamp() });
            await withTimeout(again.commit(), CHAT_SEND_TIMEOUT_MS)
              .then(() => done.push(...rest.map((i) => i.id)))
              .catch(() => {});
          }
          return done;
        }
      }),
    watchCrewChat(crewId, max, listener, onError) {
      if (!firebaseConfigured(config)) return () => {};
      return onSnapshot(
        query(collection(fb().db, ...room(crewId), 'chat'), orderBy('sentAt', 'desc'), limit(max)),
        (snap) => !nothingYet(snap) && listener(snap.docs.map((d) => crewMessageFromDoc(crewId, d.id, d.data({ serverTimestamps: 'estimate' }))).filter((m): m is CrewMessage => !!m)),
        (e) => onError?.(asSocialError(e)),
      );
    },
    markCrewChatRead: (crewId) =>
      guard(async () => {
        const user = me();
        await withTimeout(setDoc(doc(fb().db, ...room(crewId), 'reads', user.uid), { at: serverTimestamp() }), CHAT_SEND_TIMEOUT_MS);
      }),
    watchCrewReads(crewId, listener, onError) {
      if (!firebaseConfigured(config)) return () => {};
      return onSnapshot(
        collection(fb().db, ...room(crewId), 'reads'),
        (snap) => {
          if (nothingYet(snap)) return;
          const reads: Record<string, string> = {};
          for (const d of snap.docs) {
            const at = readTime(d.data({ serverTimestamps: 'estimate' }).at);
            if (at) reads[d.id] = at;
          }
          listener(reads);
        },
        (e) => onError?.(asSocialError(e)),
      );
    },
    deleteCrewMessage: (crewId, id) =>
      guard(async () => {
        await deleteDoc(doc(fb().db, ...room(crewId), 'chat', id));
      }),
    openDirectChat: (uid) =>
      guard(async () => {
        const user = me();
        const members = [user.uid, uid].sort() as [string, string];
        const id = directRoom(user.uid, uid);
        const ref_ = doc(fb().db, ...room(id));
        // Made the first time; the rules check you're friends both ways and not blocked.
        const there = await getDoc(ref_).catch(() => null);
        if (!there?.exists()) await withTimeout(setDoc(ref_, { members, createdAt: serverTimestamp() }), CHAT_SEND_TIMEOUT_MS);
        return id;
      }),
    watchDirectChats(listener, onError) {
      if (!firebaseConfigured(config)) return () => {};
      const user = fb().auth.currentUser;
      if (!user) return () => {};
      return onSnapshot(
        query(collection(fb().db, 'dms'), where('members', 'array-contains', user.uid), limit(200)),
        (snap) =>
          !nothingYet(snap) &&
          listener(
            snap.docs.flatMap((d) => {
              const members = d.data().members;
              return Array.isArray(members) && members.length === 2 && members.every((m) => typeof m === 'string') ? [{ id: `${DM_PREFIX}${d.id}`, members: [members[0], members[1]] as [string, string] }] : [];
            }),
          ),
        (e) => onError?.(asSocialError(e)),
      );
    },
    meetSpot: (crewId) =>
      guard(async () => meetSpotFromDoc((await readDoc(doc(fb().db, 'crews', crewId, 'meta', 'meet'))).data())),
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
          // Open from the start (HQ asks for the open ones), at the server's time (the rules check it).
          status: 'open',
          createdAt: serverTimestamp(),
        });
      }),
    blocked: () =>
      guard(async () => {
        const user = fb().auth.currentUser;
        if (!user) return [];
        const d = await readDoc(doc(fb().db, 'blocks', user.uid));
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
