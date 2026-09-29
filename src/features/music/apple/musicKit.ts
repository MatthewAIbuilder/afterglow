/**
 * The one piece of Apple Music that must be native: asking the person for
 * permission with MusicKit and getting their Music User Token. Expo Go has
 * no MusicKit, so this build ships `noMusicKit`, which says so honestly and
 * never pretends to connect.
 *
 * To finish Apple Music (see docs/music-integrations.md): add a MusicKit
 * module in a development build (an Expo module wrapping
 * `MusicAuthorization.request()` and `MusicUserTokenProvider`) and pass an
 * authorizer built on it to `appleMusicService` in services.ts. Nothing
 * else changes.
 */
export type MusicKitAuthorization =
  | { status: 'authorized'; userToken: string }
  | { status: 'denied' | 'restricted' | 'cancelled' };

export type AppleMusicAuthorizer = {
  /** MusicKit exists in this build. */
  isSupported(): boolean;
  /** Show Apple's permission prompt, then get a Music User Token for this developer token. */
  authorize(developerToken: string): Promise<MusicKitAuthorization>;
};

export const noMusicKit: AppleMusicAuthorizer = {
  isSupported: () => false,
  authorize: async () => ({ status: 'cancelled' }),
};
