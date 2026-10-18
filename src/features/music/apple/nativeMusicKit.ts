import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { noMusicKit, type AppleMusicAuthorizer, type MusicKitAuthorization } from './musicKit';

type NativeMusicKit = {
  developerToken(): Promise<string>;
  authorize(developerToken: string): Promise<{ status?: string; userToken?: string }>;
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
    developerToken: () => native.developerToken(),
    async authorize(developerToken) {
      return readAuthorization(await native.authorize(developerToken));
    },
  };
}

/** What MusicKit answered, checked: a user token only counts when it's there. Pure. */
export function readAuthorization(answer: { status?: string; userToken?: string } | null | undefined): MusicKitAuthorization {
  if (answer?.status === 'authorized' && typeof answer.userToken === 'string' && answer.userToken) return { status: 'authorized', userToken: answer.userToken };
  if (answer?.status === 'denied' || answer?.status === 'restricted') return { status: answer.status };
  return { status: 'cancelled' };
}
