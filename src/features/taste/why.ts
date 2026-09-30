import type { Clip } from '../../data/models';
import type { Rating, Ratings } from './ratings';

/**
 * What an artist's match rests on, in plain words, so a score never feels
 * arbitrary. Pure. Counts your own signals on their clips and your rating;
 * with none of those, the match came from similar sounds (or is a first
 * guess).
 */
type Reaction = { liked: boolean; saved: boolean; skipped: boolean; watched?: string };

export type ArtistSignals = {
  likes: number;
  saves: number;
  skips: number;
  watched: number;
  rating?: Rating;
  /** Music services whose library has them ("Spotify"), from the imported layer. */
  library?: string[];
};

export function artistSignals(
  artistId: string,
  clips: Clip[],
  reactions: Record<string, Reaction | undefined>,
  ratings: Ratings,
  /** Names of the music services whose library has this artist. */
  library: string[] = [],
): ArtistSignals {
  const s: ArtistSignals = { likes: 0, saves: 0, skips: 0, watched: 0, rating: ratings[artistId], library: library.length ? library : undefined };
  for (const c of clips) {
    if (c.artistId !== artistId) continue;
    const r = reactions[c.id];
    if (!r) continue;
    if (r.liked) s.likes++;
    if (r.saved) s.saves++;
    if (r.skipped && !r.liked) s.skips++;
    if ((r.watched === 'through' || r.watched === 'replayed') && !r.skipped) s.watched++;
  }
  return s;
}

const count = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : undefined);

/**
 * "From your 2 likes and 1 save", "From your Spotify library and 1 like",
 * "From your rating and 1 like". The rating
 * itself is shown right beside this on the artist page, so it's only named.
 * `informed` says whether anything real is behind the match. `nearLibrary`
 * names the services whose library lifts this artist only by sounding alike
 * ("Close to artists in your Spotify library").
 */
export function whyLine(s: ArtistSignals, informed: boolean, nearLibrary: string[] = []): string {
  const parts = [
    s.library?.length ? `${s.library.join(' and ')} ${s.library.length === 1 ? 'library' : 'libraries'}` : undefined,
    s.rating ? 'rating' : undefined,
    count(s.likes, 'like', 'likes'),
    count(s.saves, 'save', 'saves'),
    count(s.watched, 'clip watched through', 'clips watched through'),
    count(s.skips, 'skip', 'skips'),
  ].filter((p): p is string => !!p);
  if (parts.length) {
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
    return `From your ${list}`;
  }
  if (nearLibrary.length) return `Close to artists in your ${nearLibrary.join(' and ')} ${nearLibrary.length === 1 ? 'library' : 'libraries'}`;
  return informed ? 'From sounds you like' : 'A first guess. Rate them or react to their clips to sharpen it.';
}
