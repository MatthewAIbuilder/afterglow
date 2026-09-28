import type { Clip, ClipSource } from '../../data/types';
import { playableSource, posterUrl, watchUrl } from './youtube';

/**
 * What Discover needs to know about a clip's real footage, whatever plays it.
 * Only ClipPlayer and this file know which provider is behind a clip, so a
 * native video source can later be added here without touching the feed.
 */
export type ClipMedia = {
  provider: 'youtube';
  /** Provider details, read only by the matching player. */
  source: ClipSource;
  /** Length of the clip section in seconds. */
  lengthSec: number;
  /** Still shown while the player loads. */
  posterUrl: string;
  /** Tall footage gets a tall player. */
  vertical: boolean;
  /** Credit line under the clip. */
  credit: string;
  /** Where to watch the original if it can't play here. */
  externalUrl: string;
};

/** The clip's playable footage, or undefined and the card shows the stage. */
export function clipMedia(clip: Clip): ClipMedia | undefined {
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
