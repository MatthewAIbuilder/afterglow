/**
 * How a crowd video fills the screen, pure: it fills the screen edge to edge
 * only when that crops very little (an upright video on an upright phone);
 * otherwise the whole picture shows, with the night around it. A video whose
 * shape isn't known yet shows whole, so nothing is ever cut off by guessing.
 */
export type VideoSize = { width: number; height: number };

/** At most this share of the picture may be cut off to fill the screen. */
export const MAX_CROP = 0.12;

const known = (s: Partial<VideoSize> | undefined): s is VideoSize => !!s?.width && !!s?.height && s.width > 0 && s.height > 0;

export function fitFor(video: Partial<VideoSize> | undefined, screen: Partial<VideoSize>): 'cover' | 'contain' {
  if (!known(video) || !known(screen)) return 'contain';
  const v = video.width / video.height;
  const s = screen.width / screen.height;
  // The share of the picture filling the screen would cut off.
  const crop = 1 - Math.min(v, s) / Math.max(v, s);
  return crop <= MAX_CROP ? 'cover' : 'contain';
}
