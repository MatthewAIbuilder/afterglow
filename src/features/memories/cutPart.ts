import type { ClipWindow } from './trim';

/**
 * Cutting the part that plays out of a video before it's shared. Only the
 * website needs it (`cutPart.web.ts`): the phone's own picker trims a long
 * video before Afterglow sees it, so here there's nothing to cut.
 */
export async function cutVideoPart(_video: Blob, _clip: ClipWindow): Promise<{ blob: Blob; clip: ClipWindow } | undefined> {
  return undefined;
}
