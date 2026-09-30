import type { MusicArtistSignal } from './models';

/**
 * How strongly a library says "I like this artist", 0 to 1. Pure, and the
 * one place the parts of a library are weighed against each other, so they
 * can be tuned together.
 *
 * Conservative on purpose: one saved song is a weak hint (0.15), while
 * following an artist, saving a lot of their songs and playing them often
 * adds up to a clear one (1). The taste engine then scales this well below a
 * single like in Afterglow (see `IMPORT_WEIGHT` in taste/engine.ts).
 */
export const LIBRARY_STRENGTH = {
  /** You follow or favourite them. */
  followed: 0.5,
  /** Saved songs, on a log scale: 1 song 0.15, 3 songs 0.3, 7 or more 0.45. */
  savedPerDoubling: 0.15,
  savedMax: 0.45,
  /** Among the artists you play most: rank 1 gets `topFirst`, rank `TOP_RANKS` gets `topLast`. */
  topFirst: 0.35,
  topLast: 0.1,
  /** Played in the last few weeks. */
  recent: 0.2,
} as const;

/** Top-artist lists are read this deep. */
export const TOP_RANKS = 50;

export function artistStrength(a: Pick<MusicArtistSignal, 'followed' | 'savedTracks' | 'topRank' | 'recent'>): number {
  const W = LIBRARY_STRENGTH;
  let s = 0;
  if (a.followed) s += W.followed;
  if (a.savedTracks > 0) s += Math.min(W.savedMax, W.savedPerDoubling * Math.log2(1 + a.savedTracks));
  if (a.topRank !== undefined && a.topRank >= 1) {
    const t = Math.min(1, (a.topRank - 1) / (TOP_RANKS - 1));
    s += W.topFirst - (W.topFirst - W.topLast) * t;
  }
  if (a.recent) s += W.recent;
  return Math.min(1, s);
}
