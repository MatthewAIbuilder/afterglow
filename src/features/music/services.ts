import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { APPLE_MUSIC_TOKEN_URL, SPOTIFY_CLIENT_ID } from '../../config/music';
import { noMusicKit } from './apple/musicKit';
import { appleMusicService } from './apple/service';
import type { FetchLike } from './http';
import type { MusicProviderId } from './models';
import { secureSecrets } from './secrets';
import type { MusicService } from './service';
import { spotifySignIn } from './spotify/signIn';
import { spotifyService } from './spotify/service';

/**
 * The music services this build can use, wired to the real sign-in, secure
 * store and network. The rest of the app gets them through
 * `MusicConnectionsProvider` and never imports an adapter directly.
 */
export type MusicServices = Record<MusicProviderId, MusicService>;

export function defaultMusicServices(): MusicServices {
  const fetchFn: FetchLike = (url, init) => fetch(url, init);
  return {
    spotify: spotifyService({
      clientId: SPOTIFY_CLIENT_ID,
      secrets: secureSecrets,
      fetch: fetchFn,
      signIn: spotifySignIn,
      secureStorage: Platform.OS !== 'web',
      // Expo Go's return address (exp://<computer>/--/…) changes with the network and Spotify won't accept it.
      needsOwnApp: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
    }),
    'apple-music': appleMusicService({
      authorizer: noMusicKit,
      tokenUrl: APPLE_MUSIC_TOKEN_URL,
      secrets: secureSecrets,
      fetch: fetchFn,
      isIOS: Platform.OS === 'ios',
    }),
  };
}
