import { Platform } from 'react-native';
import { APPLE_MUSIC_TOKEN_URL } from '../../config/music';
import { nativeMusicKit } from './apple/nativeMusicKit';
import { appleMusicService } from './apple/service';
import type { FetchLike } from './http';
import type { MusicProviderId } from './models';
import { secureSecrets } from './secrets';
import type { MusicService } from './service';
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
      secrets: secureSecrets,
      fetchText: (url) => fetch(url),
      // A browser can't read Spotify's pages from another website (and has no secure store).
      onPhone: Platform.OS !== 'web',
    }),
    'apple-music': appleMusicService({
      authorizer: nativeMusicKit(),
      tokenUrl: APPLE_MUSIC_TOKEN_URL,
      secrets: secureSecrets,
      fetch: fetchFn,
      isIOS: Platform.OS === 'ios',
    }),
  };
}
