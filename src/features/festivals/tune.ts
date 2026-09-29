import type { Festival } from '../../data/models';
import type { Ratings } from '../taste/ratings';

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
