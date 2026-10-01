import type { Artist, Clip } from '../../data/models';
import type { SeenHistory } from '../recommend/feed';

/**
 * What to watch next from an artist page: their own clips (ones you haven't
 * had on screen first), and "Fans also watch", one clip each from the
 * artists who sound most like them, unwatched ones first, so one artist
 * leads to the next. Pure.
 */
export const ALSO_WATCH_MAX = 6;
/** How alike an artist must be to count. */
export const ALSO_WATCH_MIN = 0.3;

const unseenFirst = (clips: readonly Clip[], seen: SeenHistory) =>
  clips.map((c, i) => ({ c, i })).sort((a, b) => Number(a.c.id in seen) - Number(b.c.id in seen) || a.i - b.i).map((x) => x.c);

/** An artist's clips with the ones you haven't watched first (catalogue order otherwise). */
export const theirClips = (clips: readonly Clip[], seen: SeenHistory) => unseenFirst(clips, seen);

export type AlsoWatch = { artist: Artist; clip: Clip; seen: boolean };

/**
 * One clip from each of the artists most like this one who have clips:
 * most alike first, but anyone whose clips you've all seen goes after
 * those with something new. At most `max`.
 */
export function alsoWatch(
  artist: Artist,
  artists: readonly Artist[],
  clipsOf: (artistId: string) => readonly Clip[],
  similarity: (a: Artist, b: Artist) => number,
  seen: SeenHistory,
  { max = ALSO_WATCH_MAX, min = ALSO_WATCH_MIN }: { max?: number; min?: number } = {},
): AlsoWatch[] {
  return artists
    .filter((a) => a.id !== artist.id && clipsOf(a.id).length > 0)
    .map((a) => ({ a, s: similarity(artist, a) }))
    .filter((x) => x.s > min)
    .sort((p, q) => q.s - p.s)
    .map(({ a }) => {
      const clip = unseenFirst(clipsOf(a.id), seen)[0];
      return { artist: a, clip, seen: clip.id in seen };
    })
    .sort((p, q) => Number(p.seen) - Number(q.seen))
    .slice(0, max);
}
