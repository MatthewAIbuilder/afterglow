/**
 * Back to back: a video of two (or more) artists playing together. The first
 * artist is the one the video belongs to (Discover ranks it by them); the
 * others are with them. Pure.
 */
export const B2B_MAX = 3;

/** The others, read back safely: Afterglow ids, each once, never the main artist, at most B2B_MAX. */
export function cleanWith(raw: unknown, main?: string): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string' || !/^[A-Za-z0-9_.:-]{1,100}$/.test(v) || v === main || out.includes(v)) continue;
    out.push(v);
    if (out.length >= B2B_MAX) break;
  }
  return out.length ? out : undefined;
}

/** "BOOGIE T b2b SUBTRONICS". */
export const b2bLine = (names: readonly string[]) => names.filter(Boolean).join(' b2b ');

/** Everyone on a video, main artist first. */
export const allArtists = (m: { artistId?: string; withArtistIds?: readonly string[] }) => (m.artistId ? [m.artistId, ...(m.withArtistIds ?? [])] : []);
