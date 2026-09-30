import type { Profile, ProfileInput, ReportReason, SharedMemory, SocialUser } from './models';

/**
 * The boundary every social backend implements. The app only talks to
 * profiles, shared memories, reports and blocks through this; Firebase stays
 * inside its adapter (features/social/firebase/), and tests use an in-memory
 * version. Like the music services, nothing outside features/social/ imports
 * an adapter.
 */
export type SocialAvailability = { ok: true } | { ok: false; reason: 'not-set-up' };

export type ShareInput = {
  /** The memory's local id, kept with the shared copy so it can be found again. */
  memoryId: string;
  videoUri: string;
  thumbUri?: string;
  festivalId?: string;
  night?: string;
  artistId?: string;
  capturedAt: string;
  durationSec?: number;
};

export type ReportTarget = { kind: 'profile' | 'memory'; id: string; ownerUid: string };

export interface SocialService {
  availability(): SocialAvailability;
  /** Called with the signed-in user (or null) now and whenever it changes. Returns an unsubscribe. */
  onAuthChange(listener: (user: SocialUser | null) => void): () => void;
  signUp(email: string, password: string): Promise<SocialUser>;
  signIn(email: string, password: string): Promise<SocialUser>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  /** Deletes your profile, shared memories, blocks and the account itself. Needs your password again. */
  deleteAccount(password: string): Promise<void>;

  profileOf(uid: string): Promise<Profile | null>;
  profileByHandle(handle: string): Promise<Profile | null>;
  /** Saves your profile, claiming the handle; `festivals` and `sounds` are published only when switched on. */
  saveProfile(input: ProfileInput, published: { festivals: string[]; sounds: Profile['sounds'] }): Promise<Profile>;
  /** Replace (a local image uri) or remove (null) your profile photo. */
  setAvatar(uri: string | null): Promise<Profile>;
  handleAvailable(handle: string): Promise<boolean>;
  searchProfiles(query: string): Promise<Profile[]>;

  shareMemory(input: ShareInput, onProgress?: (share: number) => void): Promise<SharedMemory>;
  unshareMemory(sharedId: string): Promise<void>;
  memoriesOf(uid: string): Promise<SharedMemory[]>;
  sharedMemory(id: string): Promise<SharedMemory | null>;

  report(target: ReportTarget, reason: ReportReason, note?: string): Promise<void>;
  blocked(): Promise<string[]>;
  setBlocked(uid: string, blocked: boolean): Promise<void>;
}

export type SocialErrorKind =
  | 'email-in-use'
  | 'invalid-email'
  | 'weak-password'
  | 'wrong-password'
  | 'no-account'
  | 'too-many-attempts'
  | 'handle-taken'
  | 'not-signed-in'
  | 'no-profile'
  | 'too-large'
  | 'network'
  | 'unavailable'
  | 'unknown';

export class SocialError extends Error {
  readonly kind: SocialErrorKind;
  constructor(kind: SocialErrorKind, message: string = kind) {
    super(message);
    this.name = 'SocialError';
    this.kind = kind;
  }
}

export const socialErrorKind = (e: unknown): SocialErrorKind => (e instanceof SocialError ? e.kind : 'unknown');

/** Each error in plain words. */
export const SOCIAL_ERROR_COPY: Record<SocialErrorKind, string> = {
  'email-in-use': 'There’s already an account with that email. Sign in instead.',
  'invalid-email': 'That email doesn’t look right.',
  'weak-password': 'Choose a longer password (at least 8 characters).',
  'wrong-password': 'That email and password don’t match.',
  'no-account': 'That email and password don’t match.',
  'too-many-attempts': 'Too many tries. Wait a few minutes and try again.',
  'handle-taken': 'Someone already has that handle.',
  'not-signed-in': 'Sign in to do that.',
  'no-profile': 'Create your profile first.',
  'too-large': 'That video is too big to share. Try a shorter clip.',
  network: 'Couldn’t reach Afterglow. Check your connection and try again.',
  unavailable: 'Profiles aren’t available in this version of Afterglow yet.',
  unknown: 'Something went wrong. Try again.',
};

/** Shared videos are at most this big (the storage rules enforce it too). */
export const MAX_SHARE_BYTES = 150 * 1024 * 1024;
