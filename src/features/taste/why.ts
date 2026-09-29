import type { Clip } from '../../data/models';
import type { Ratings } from './ratings';

/**
 * What an artist's match rests on, in plain words, so a score never feels
 * arbitrary. Pure. Counts your own signals on their clips and your rating;
 * with none of those, the match came from similar sounds (or is a first
 * guess).
 */
type Reaction = { liked: boolean; saved: boolean; skipped: boolean; watched?: string };

export type ArtistSignals = { likes: number; saves: number; skips: number; watched: number; rating?: 'love' | 'pass' };

export function artistSignals(
  artistId: string,
  clips: Clip[],
  reactions: Record<string, Reaction | undefined>,
  ratings: Ratings,
): ArtistSignals {
  const s: ArtistSignals = { likes: 0, saves: 0, skips: 0, watched: 0, rating: ratings[artistId] };
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
 * "From your 2 likes and 1 save", "From your rating and 1 like". The rating
 * itself is shown right beside this on the artist page, so it's only named.
 * `informed` says whether anything real is behind the match.
 */
export function whyLine(s: ArtistSignals, informed: boolean): string {
  const parts = [
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
  return informed ? 'From sounds you like' : 'A first guess. Rate them or react to their clips to sharpen it.';
}
