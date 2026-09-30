import { SOUND_TAGS, type SoundTag } from '../../../data/models';
import { CREW_MAX, CREW_PICKS_MAX, type Crew, type CrewPicks, type Profile, type SharedMemory } from '../models';
import { SocialError, type SocialErrorKind } from '../service';

/**
 * Database documents to the app's shapes, without trusting them: a field of
 * the wrong type is dropped, never passed on. Pure, and tested.
 */
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const strs = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : []);
const https = (v: unknown) => (typeof v === 'string' && v.startsWith('https://') ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);

export function profileFromDoc(uid: string, d: unknown): Profile | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const handle = str(o.handle);
  if (!handle) return null;
  return {
    uid,
    handle,
    displayName: str(o.displayName) ?? handle,
    bio: str(o.bio) ?? '',
    avatarUrl: https(o.avatarUrl),
    festivals: strs(o.festivals, 50),
    sounds: strs(o.sounds, 3).filter((s): s is SoundTag => (SOUND_TAGS as readonly string[]).includes(s)),
    showFestivals: o.showFestivals === true,
    showSound: o.showSound === true,
    createdAt: str(o.createdAt) ?? '',
    updatedAt: str(o.updatedAt) ?? '',
  };
}

export function memoryFromDoc(id: string, d: unknown): SharedMemory | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const uid = str(o.uid);
  const videoUrl = https(o.videoUrl);
  const capturedAt = str(o.capturedAt);
  if (!uid || !videoUrl || !capturedAt) return null;
  return {
    id,
    uid,
    handle: str(o.handle) ?? '',
    videoUrl,
    thumbUrl: https(o.thumbUrl),
    festivalId: str(o.festivalId),
    night: str(o.night),
    artistId: str(o.artistId),
    capturedAt,
    durationSec: num(o.durationSec),
    width: num(o.width),
    height: num(o.height),
    createdAt: str(o.createdAt) ?? '',
  };
}

export function crewFromDoc(id: string, d: unknown): Crew | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const festivalId = str(o.festivalId);
  const owner = str(o.owner);
  const members = strs(o.members, CREW_MAX);
  if (!festivalId || !owner || !members.includes(owner)) return null;
  return { id, festivalId, name: str(o.name) ?? '', owner, members, createdAt: str(o.createdAt) ?? '' };
}

export function crewPicksFromDoc(uid: string, d: unknown): CrewPicks | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  return { uid, artists: strs(o.artists, CREW_PICKS_MAX), updatedAt: str(o.updatedAt) ?? '' };
}

/** Firebase's error codes as the app's kinds. */
export function firebaseErrorKind(e: unknown): SocialErrorKind {
  const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'email-in-use';
    case 'auth/invalid-email':
      return 'invalid-email';
    case 'auth/weak-password':
      return 'weak-password';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'wrong-password';
    case 'auth/user-not-found':
      return 'no-account';
    case 'auth/too-many-requests':
      return 'too-many-attempts';
    case 'auth/network-request-failed':
    case 'unavailable':
    case 'deadline-exceeded':
    case 'storage/retry-limit-exceeded':
      return 'network';
    default:
      return 'unknown';
  }
}

export const asSocialError = (e: unknown) => (e instanceof SocialError ? e : new SocialError(firebaseErrorKind(e)));

/** A video's content type from its file name. */
export function videoType(uri: string): string {
  const ext = uri.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'm4v') return 'video/x-m4v';
  return 'video/mp4';
}

/** The end of a name range query: everything that starts with `q`. */
export const prefixEnd = (q: string) => `${q}`;
