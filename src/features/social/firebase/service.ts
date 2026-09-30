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
  getDoc,
  getDocs,
  initializeFirestore,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytesResumable, type FirebaseStorage } from 'firebase/storage';
import type { FIREBASE_CONFIG } from '../../../config/social';
import { firebaseConfigured } from '../../../config/social';
import type { Profile } from '../models';
import { SocialError, MAX_SHARE_BYTES, type SocialService } from '../service';
import { cleanProfileInput, handleProblem, normalizeHandle, profileProblems } from '../validate';
import { asSocialError, memoryFromDoc, prefixEnd, profileFromDoc, videoType } from './mapping';

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
 *   memories/{id}       uid, handle, videoPath, videoUrl, thumbPath, thumbUrl, festivalId, night, artistId, capturedAt, durationSec, createdAt
 *   blocks/{uid}        { uids: [...] }: only you can read or write yours
 *   reports/{id}        by, kind, targetId, ownerUid, reason, note, createdAt: create-only
 * Storage: memories/{uid}/{id}.(mp4|mov|m4v|jpg), avatars/{uid}.jpg
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
    try {
      auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      // Already initialised (a fast refresh in development).
      auth = getAuth(app);
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
        await deleteDoc(memRef);
        await removeFile(data.videoPath);
        await removeFile(data.thumbPath);
      }),
    memoriesOf: (uid) =>
      guard(async () => {
        const snap = await getDocs(query(collection(fb().db, 'memories'), where('uid', '==', uid), orderBy('capturedAt', 'desc'), limit(60)));
        return snap.docs.map((d) => memoryFromDoc(d.id, d.data())).filter((m): m is NonNullable<typeof m> => !!m);
      }),
    sharedMemory: (id) => guard(async () => memoryFromDoc(id, (await getDoc(doc(fb().db, 'memories', id))).data())),

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
