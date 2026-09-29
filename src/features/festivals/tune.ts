import type { Artist, Festival } from '../../data/models';
import type { Ratings } from '../taste/ratings';
import { mostSimilar, type Similarity } from '../taste/similarity';

/**
 * "Tune your lineup": rate a festival's artists one at a time. Pure.
 *
 * The queue is the lineup in billing order, minus anyone you've already rated
 * and anyone not in the catalogue. It's worked out once when you start, so
 * the order doesn't shift under you as your ratings reshape the matches.
 */
export function tuneQueue(festival: Festival, ratings: Ratings, isArtist: (id: string) => boolean): string[] {
  return festival.lineup.filter((id) => isArtist(id) && !ratings[id]);
}

/** How many of a festival's artists you haven't rated yet. */
export const leftToRate = (festival: Festival, ratings: Ratings, isArtist: (id: string) => boolean) =>
  tuneQueue(festival, ratings, isArtist).length;

/** How close a sound must be to say one artist "sounds like" another. */
export const SOUNDS_LIKE_MIN = 0.4;

/**
 * Up to two artists you already like whom this one sounds like, closest
 * first, to help you answer for someone you don't know. `liked` says who
 * counts (say, ones you love or strongly match). Empty when none are close.
 */
export function soundsLike(artist: Artist, artists: Artist[], liked: (a: Artist) => boolean, similarity: Similarity) {
  return mostSimilar(
    artist,
    artists.filter((a) => a.id !== artist.id && liked(a)),
    similarity,
    { max: 2, min: SOUNDS_LIKE_MIN },
  );
}
