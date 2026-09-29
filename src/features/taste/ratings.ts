/**
 * Artists you've rated directly, without watching a clip: "love their sound"
 * or "not for me". The way to tell Afterglow about a big lineup the feed has
 * no clips for. Explicit signals, as strong as a save or a skip, fed to the
 * taste engine alongside clip reactions. Pure.
 */
export type Rating = 'love' | 'pass';
export type Ratings = Record<string, Rating>;

export const isRating = (r: unknown): r is Rating => r === 'love' || r === 'pass';

/** Set or clear one artist's rating. Returns the same object when nothing changes. */
export function rate(all: Ratings, artistId: string, rating: Rating | undefined): Ratings {
  if (all[artistId] === rating) return all;
  const next = { ...all };
  if (rating) next[artistId] = rating;
  else delete next[artistId];
  return next;
}

/** Keep only well-formed ratings, e.g. when reading them back from storage. */
export function cleanRatings(raw: unknown): Ratings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Ratings = {};
  for (const [id, r] of Object.entries(raw)) if (isRating(r)) out[id] = r;
  return out;
}
