import type { Artist } from '../../data/models';

/** The countdown lights on an Up next card: one a night for the last two weeks. */
export const LIGHT_NIGHTS = 14;

/**
 * The last fortnight before a festival as a row of lights, one per night:
 * the ones already behind you lit, the ones still to come dark. Undefined
 * further out (a number says it better) and once it's on. Pure.
 */
export function countdownLights(daysToGo: number, nights = LIGHT_NIGHTS): boolean[] | undefined {
  if (daysToGo <= 0 || daysToGo > nights) return undefined;
  return Array.from({ length: nights }, (_, i) => i < nights - daysToGo);
}

/**
 * Your top artists on a lineup, best match first (the lineup already ranked
 * by your taste), with the match as a whole percent; artists with no match
 * at all are left out. Pure.
 */
export function topForYou(ranked: readonly Artist[], taste: Readonly<Record<string, number>>, max = 3): { artist: Artist; match: number }[] {
  return ranked
    .filter((a) => (taste[a.id] ?? 0) > 0)
    .slice(0, max)
    .map((artist) => ({ artist, match: Math.round(Math.min(1, taste[artist.id] ?? 0) * 100) }));
}
