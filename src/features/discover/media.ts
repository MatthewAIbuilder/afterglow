import type { Clip, CommunityClipSource, SoundCloudClipSource, YouTubeClipSource } from '../../data/models';
import { playableSource, posterUrl, watchUrl } from './youtube';

/**
 * What Discover needs to know about a clip's real footage, whatever plays it.
 * Only ClipPlayer and this file know which provider is behind a clip.
 *
 * - youtube: a section of an official upload, in YouTube's embedded player.
 * - video: a video file someone shared (a community clip), in the phone's
 *   own player (expo-video).
 * - soundcloud: an artist's SoundCloud page (their uploads), in SoundCloud's
 *   embedded player.
 */
type Shared = {
  /** Length of the clip in seconds. */
  lengthSec: number;
  /** Still shown while the player loads. */
  posterUrl: string;
  /** Tall footage gets a tall player. */
  vertical: boolean;
  /** Credit line under the clip. */
  credit: string;
};

export type YouTubeMedia = Shared & {
  provider: 'youtube';
  /** Provider details, read only by the YouTube player. */
  source: YouTubeClipSource;
  /** Where to watch the original if it can't play here. */
  externalUrl: string;
};

export type VideoMedia = Shared & {
  provider: 'video';
  /** The video file to play. */
  uri: string;
  /** Who shared it and how to report it. Read by the card, not the player. */
  community: CommunityClipSource;
};

export type SoundCloudMedia = Shared & {
  provider: 'soundcloud';
  /** Provider details, read only by the SoundCloud player. */
  source: SoundCloudClipSource;
  /** The page on SoundCloud itself. */
  externalUrl: string;
};

export type ClipMedia = YouTubeMedia | VideoMedia | SoundCloudMedia;

const HTTPS = /^https:\/\//;

/**
 * The clip's playable footage, or undefined and the card shows the stage.
 * `artistImage`: the artist's photo, which a SoundCloud card shows before its own picture.
 */
export function clipMedia(clip: Clip, artistImage?: string): ClipMedia | undefined {
  const s = clip.source;
  if (s?.provider === 'soundcloud') {
    if (!/^https:\/\/soundcloud\.com\//.test(s.url)) return undefined;
    const still = [artistImage, s.image].find((u) => !!u && HTTPS.test(u));
    return { provider: 'soundcloud', source: s, lengthSec: 0, posterUrl: still ?? '', vertical: false, credit: 'On SoundCloud', externalUrl: s.url };
  }
  if (s?.provider === 'community') {
    if (!HTTPS.test(s.videoUrl)) return undefined;
    return {
      provider: 'video',
      uri: s.videoUrl,
      lengthSec: clip.durationSec,
      posterUrl: s.thumbUrl && HTTPS.test(s.thumbUrl) ? s.thumbUrl : '',
      vertical: s.vertical,
      credit: `Filmed by @${s.handle}`,
      community: s,
    };
  }
  const source = playableSource(clip);
  if (!source) return undefined;
  return {
    provider: 'youtube',
    source,
    lengthSec: source.end - source.start,
    posterUrl: posterUrl(source),
    vertical: !!source.vertical,
    credit: `${source.channel} on YouTube`,
    externalUrl: watchUrl(source),
  };
}
