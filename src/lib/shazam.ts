import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { readTrackSearch, type TrackSearch } from '../features/memories/track';

type NativeShazam = { matchVideo(uri: string): Promise<unknown> };

/** The app's own ShazamKit module (`modules/afterglow-shazam`): iPhone builds only, never Expo Go or the website. */
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<NativeShazam>('AfterglowShazam') : null;

/** This phone can look up the song in a video. */
export const canFindTracks = (): boolean => !!native;

/** The song playing in a video file on this phone (a `file://` uri), or why not. Never throws. */
export async function findTrack(uri: string): Promise<TrackSearch> {
  if (!native) return { reason: 'unsupported' };
  try {
    return readTrackSearch(await native.matchVideo(uri));
  } catch {
    return { reason: 'failed' };
  }
}
