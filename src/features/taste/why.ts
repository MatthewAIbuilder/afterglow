import type { Clip } from '../../data/models';
import type { Rating, Ratings } from './ratings';
import { t, tn } from '../../i18n';

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

/** "a, b and c", in the app's language. */
const andList = (xs: readonly string[]) => (xs.length > 1 ? t('{list} and {last}', { list: xs.slice(0, -1).join(', '), last: xs[xs.length - 1] }) : (xs[0] ?? ''));

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
    s.library?.length ? tn(s.library.length, '{names} library', '{names} libraries', { names: andList(s.library) }) : undefined,
    s.rating ? t('rating') : undefined,
    s.likes ? tn(s.likes, '{n} like', '{n} likes') : undefined,
    s.saves ? tn(s.saves, '{n} save', '{n} saves') : undefined,
    s.watched ? tn(s.watched, '{n} clip watched through', '{n} clips watched through') : undefined,
    s.skips ? tn(s.skips, '{n} skip', '{n} skips') : undefined,
  ].filter((p): p is string => !!p);
  if (parts.length) return t('From your {list}', { list: andList(parts) });
  if (nearLibrary.length) return tn(nearLibrary.length, 'Close to artists in your {names} library', 'Close to artists in your {names} libraries', { names: andList(nearLibrary) });
  return informed ? t('From sounds you like') : t('A first guess. Rate them or react to their clips to sharpen it.');
}
