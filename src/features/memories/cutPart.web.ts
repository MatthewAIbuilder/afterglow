import { cutMp4 } from './cutMp4';
import type { ClipWindow } from './trim';

/**
 * The part that plays, cut out of the chosen file in the page (cutMp4.ts:
 * nothing is re-encoded, so it's quick and looks exactly as filmed), so only
 * that part is uploaded, however long or big the whole video is. The new file
 * is joined from pieces of the original, never read whole into memory. The
 * window moves with it (the cut starts at the keyframe before the part).
 * Undefined when the file can't be cut; the whole file is shared instead.
 */
export async function cutVideoPart(video: Blob, clip: ClipWindow): Promise<{ blob: Blob; clip: ClipWindow } | undefined> {
  if (typeof video.slice !== 'function') return undefined;
  try {
    const read = async (offset: number, length: number) => new Uint8Array(await video.slice(offset, offset + length).arrayBuffer());
    const cut = await cutMp4(read, video.size, clip.start, clip.end);
    const parts = cut.pieces.map((p) => (p instanceof Uint8Array ? p : video.slice(p.offset, p.offset + p.size)));
    const blob = new Blob(parts as BlobPart[], { type: video.type });
    const round = (n: number) => Math.round(n * 100) / 100;
    const start = round(Math.max(0, clip.start - cut.from));
    return { blob, clip: { start, end: round(start + (clip.end - clip.start)) } };
  } catch {
    return undefined;
  }
}
