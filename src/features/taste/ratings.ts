/**
 * Artists you've rated directly, without watching a clip, on a five-step
 * scale from "Love them" to "Not for me" (plus not rating at all, "Don't know
 * them"). The way to tell Afterglow about a big lineup the feed has no clips
 * for, including a lukewarm opinion. Explicit signals, fed to the taste
 * engine alongside clip reactions. Pure.
 *
 * Stored as before (artistRatings.v1): the two original answers, 'love' and
 * 'pass', mean what they always did.
 */
export type Rating = 'love' | 'like' | 'ok' | 'meh' | 'pass';
export type Ratings = Record<string, Rating>;

/** Best to worst. */
export const RATINGS: Rating[] = ['love', 'like', 'ok', 'meh', 'pass'];

/** What each answer says, as a button. */
export const RATING_LABEL: Record<Rating, string> = {
  love: 'Love them',
  like: 'Like them',
  ok: 'They’re OK',
  meh: 'Not really',
  pass: 'Not for me',
};

/** How it reads back, after the artist's name for screen readers and in lists ("you like them"). */
export const RATING_SAID: Record<Rating, string> = {
  love: 'you love their sound',
  like: 'you like them',
  ok: 'you think they’re OK',
  meh: 'not really for you',
  pass: 'not for you',
};

export const isRating = (r: unknown): r is Rating => typeof r === 'string' && (RATINGS as string[]).includes(r);
/** Love or like. */
export const isWarm = (r: Rating | undefined) => r === 'love' || r === 'like';
/** Not really or not for me. */
export const isCold = (r: Rating | undefined) => r === 'meh' || r === 'pass';

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
