import { fold } from './edmtrain';

/**
 * Artist photos from Deezer's public artist search (no key, no account),
 * looked up by the nightly job (scripts/artist-photos.ts) and published in
 * the hosted catalogue's "photos" list. Chosen by the owner on 2026-09-30.
 * Pure: the job does the fetching.
 */
export const PHOTO_CREDIT = 'Deezer';
/** Most lookups in one night (new artists first); the rest wait for the next night. */
export const MAX_LOOKUPS = 600;

export const deezerSearchUrl = (name: string) => `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=10`;

type DeezerArtist = { name?: unknown; picture_big?: unknown; picture_xl?: unknown; nb_fan?: unknown };

/** Deezer's placeholder for artists without a photo has no image id in its link. */
const REAL_PHOTO = /^https:\/\/[a-z0-9.-]+\.dzcdn\.net\/images\/artist\/[0-9a-f]{32}\//;

/**
 * The photo for an artist from a Deezer search answer: only an exact name
 * match (letters and digits, accents and case ignored), the most followed if
 * there are several, and never Deezer's blank placeholder.
 */
export function pickDeezerPhoto(artistName: string, answer: unknown): string | undefined {
  const data = (answer as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return undefined;
  const want = fold(artistName);
  if (!want) return undefined;
  const matches = (data as DeezerArtist[])
    .filter((a) => typeof a.name === 'string' && fold(a.name) === want)
    .map((a) => ({ url: typeof a.picture_big === 'string' ? a.picture_big : undefined, fans: typeof a.nb_fan === 'number' ? a.nb_fan : 0 }))
    .filter((a): a is { url: string; fans: number } => !!a.url && REAL_PHOTO.test(a.url))
    .sort((a, b) => b.fans - a.fans);
  return matches[0]?.url;
}

/**
 * What tonight's job does for each artist without a photo of their own
 * (pass the artists before any photo list is applied):
 * reuse the photo published last time, or look it up (at most `max`).
 */
export function photoPlan(
  artists: readonly { id: string; name: string; imageUrl?: string }[],
  published: Record<string, string>,
  max = MAX_LOOKUPS,
): { reuse: Record<string, string>; lookUp: { id: string; name: string }[] } {
  const reuse: Record<string, string> = {};
  const lookUp: { id: string; name: string }[] = [];
  for (const a of artists) {
    if (a.imageUrl) continue; // its own photo, set in the catalogue
    if (published[a.id]) reuse[a.id] = published[a.id];
    else if (lookUp.length < max) lookUp.push({ id: a.id, name: a.name });
  }
  return { reuse, lookUp };
}
