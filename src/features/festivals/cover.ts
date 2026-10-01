import { anyPhoto } from '../../data/members';
import type { Artist, Festival } from '../../data/models';

/**
 * A festival's cover: its headliners' faces side by side, from the artist
 * photos Afterglow already has (no festival artwork). Pure.
 */

/** Most faces on a cover. */
export const COVER_MAX = 5;
/** Fewer faces than this and the card keeps its plain look. */
export const COVER_MIN = 2;

/**
 * The photos for a festival's cover: the lineup in billing order (headliners
 * first, the same for everyone), only artists with a photo, each photo once,
 * up to `max`. Empty when fewer than `COVER_MIN` have one.
 */
export function coverPhotos(festival: Festival, artist: (id: string) => Artist | undefined, max = COVER_MAX): string[] {
  const photos: string[] = [];
  for (const id of festival.lineup) {
    const a = artist(id);
    const url = a && anyPhoto(a);
    if (url && !photos.includes(url)) photos.push(url);
    if (photos.length >= max) break;
  }
  return photos.length >= COVER_MIN ? photos : [];
}
