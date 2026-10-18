/**
 * The one piece of Apple Music that must be native: asking the person for
 * permission with MusicKit and getting their Music User Token. The app's own
 * builds carry it (`modules/afterglow-musickit`, wrapped in
 * `nativeMusicKit.ts`); Expo Go and the website don't, so there `noMusicKit`
 * says so honestly and never pretends to connect.
 */
export type MusicKitAuthorization =
  | { status: 'authorized'; userToken: string }
  | { status: 'denied' | 'restricted' | 'cancelled' };

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
