import { SPECTRUM as spectrum } from '../../theme/palettes';

/**
 * Every festival and club show has its own light, one of the six festival
 * colours (rose, tangerine, gold, mint, sky, violet), picked from its id so
 * it stays the same everywhere and every time. Pure.
 */
export function festivalLight(id: string): string {
  return spectrum[lightIndex(id)];
}

/**
 * Its light and the one before it in the spectrum (gold and tangerine, rose
 * and violet…), for a two-tone wash like a sunset on the bigger cards.
 */
export function festivalLights(id: string): [string, string] {
  const i = lightIndex(id);
  return [spectrum[i], spectrum[(i + spectrum.length - 1) % spectrum.length]];
}

/**
 * Which of the six lights an id gets: FNV-1a, well mixed, so ids that differ
 * only near the end ("edc-orlando-26", "edc-orlando-27") still spread out.
 */
export function lightIndex(id: string): number {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) % spectrum.length;
}

/**
 * The month headings on the timeline walk through the lights as the year
 * goes on: January rose, February tangerine… and round again in July.
 * "YYYY-MM-DD" in; undefined without a date.
 */
export function monthLight(startDate: string | undefined): string | undefined {
  const m = Number(startDate?.slice(5, 7));
  return m >= 1 && m <= 12 ? spectrum[(m - 1) % spectrum.length] : undefined;
}
