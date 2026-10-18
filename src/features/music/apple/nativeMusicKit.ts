import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { MusicKitError, musicKitProblem, noMusicKit, type AppleMusicAuthorizer, type MusicKitAuthorization } from './musicKit';

type NativeMusicKit = {
  developerToken(): Promise<{ token?: string; error?: string }>;
  authorize(developerToken: string): Promise<{ status?: string; userToken?: string; reason?: string }>;
};

/**
 * Apple Music through the app's own MusicKit module
 * (`modules/afterglow-musickit`): only in the app's own iPhone builds, never
 * in Expo Go or on the website, where it falls back to `noMusicKit`.
 */
export function nativeMusicKit(): AppleMusicAuthorizer {
  const native = Platform.OS === 'ios' ? requireOptionalNativeModule<NativeMusicKit>('AfterglowMusicKit') : null;
  if (!native) return noMusicKit;
  return {
    isSupported: () => true,
    async developerToken() {
      const answer = await native.developerToken();
      if (typeof answer?.token === 'string' && answer.token) return answer.token;
      // No token is almost always Apple Music not yet switched on for the app.
      const problem = musicKitProblem(answer?.error);
      throw new MusicKitError(problem === 'unknown' ? 'not-ready' : problem);
    },
    async authorize(developerToken) {
      return readAuthorization(await native.authorize(developerToken));
    },
  };
}

/** What MusicKit answered, checked: a user token only counts when it's there. Pure. */
export function readAuthorization(answer: { status?: string; userToken?: string; reason?: string } | null | undefined): MusicKitAuthorization {
  if (answer?.status === 'authorized' && typeof answer.userToken === 'string' && answer.userToken) return { status: 'authorized', userToken: answer.userToken };
  if (answer?.status === 'failed') return { status: 'failed', problem: musicKitProblem(answer.reason) };
  if (answer?.status === 'denied' || answer?.status === 'restricted') return { status: answer.status };
  return { status: 'cancelled' };
}
