/**
 * The one piece of Apple Music that must be native: asking the person for
 * permission with MusicKit and getting their Music User Token. The app's own
 * builds carry it (`modules/afterglow-musickit`, wrapped in
 * `nativeMusicKit.ts`); Expo Go and the website don't, so there `noMusicKit`
 * says so honestly and never pretends to connect.
 */
export type MusicKitAuthorization =
  | { status: 'authorized'; userToken: string }
  | { status: 'denied' | 'restricted' | 'cancelled' }
  | { status: 'failed'; problem: MusicKitProblem };

/** Why MusicKit couldn't connect, in the words the screen explains. */
export type MusicKitProblem = 'not-ready' | 'music-app' | 'signed-out' | 'no-library' | 'unknown';

/**
 * MusicKit's own error, by name (its `MusicTokenRequestError` case, or the
 * module's own words), as a problem the person can fix. Pure.
 */
export function musicKitProblem(reason: unknown): MusicKitProblem {
  const r = typeof reason === 'string' ? reason : '';
  if (/developerToken/i.test(r)) return 'not-ready';
  if (/privacyAcknowledgement/i.test(r)) return 'music-app';
  if (/userNotSignedIn/i.test(r)) return 'signed-out';
  if (/no-library/i.test(r)) return 'no-library';
  return 'unknown';
}

/** A developer token MusicKit couldn't give, with why. */
export class MusicKitError extends Error {
  readonly problem: MusicKitProblem;
  constructor(problem: MusicKitProblem) {
    super(`MusicKit: ${problem}`);
    this.name = 'MusicKitError';
    this.problem = problem;
  }
}

export type AppleMusicAuthorizer = {
  /** MusicKit exists in this build. */
  isSupported(): boolean;
  /** Show Apple's permission prompt, then get a Music User Token for this developer token. */
  authorize(developerToken: string): Promise<MusicKitAuthorization>;
  /** MusicKit's own developer token (when the app's identifier has MusicKit on), so no token link is needed. */
  developerToken?: () => Promise<string>;
};

export const noMusicKit: AppleMusicAuthorizer = {
  isSupported: () => false,
  authorize: async () => ({ status: 'cancelled' }),
};
