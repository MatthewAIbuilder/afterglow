import type { Artist, Clip } from '../../data/models';
import type { Pick as PlanPick } from './plan';

/**
 * A warm-up playlist for a festival: the live sets behind the Discover clips
 * of the artists you'd love there, in your plan's order, as one YouTube
 * playlist. Pure. YouTube makes a playlist from a list of video ids
 * (`watch_videos?video_ids=…`), so nothing is created on anyone's account and
 * nothing is copied: it's YouTube's own player and the uploaders' own videos.
 *
 * Who's in it: must-sees and strong matches first, then explore picks you have
 * real signal for; one video per artist (their first YouTube clip), never the
 * same video twice; at most `WARMUP_MAX` (YouTube's limit is 50).
 */
export const WARMUP_MAX = 50;
/** A playlist needs at least this many sets to be worth offering. */
export const WARMUP_MIN = 2;

export type Warmup = { url: string; artists: Artist[] };

export function warmupPlaylist(picks: readonly PlanPick[], clipsOf: (artistId: string) => readonly Clip[]): Warmup | undefined {
  const chosen = picks.filter((p) => p.tier !== 'explore' || p.known);
  const order = [...chosen].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const ids: string[] = [];
  const artists: Artist[] = [];
  for (const p of order) {
    const clip = clipsOf(p.artist.id).find((c) => c.source?.provider === 'youtube' && !ids.includes(c.source.videoId));
    if (!clip || clip.source?.provider !== 'youtube') continue;
    ids.push(clip.source.videoId);
    artists.push(p.artist);
    if (ids.length >= WARMUP_MAX) break;
  }
  if (ids.length < WARMUP_MIN) return undefined;
  return { url: `https://www.youtube.com/watch_videos?video_ids=${ids.join(',')}`, artists };
}

/** "ILLENIUM, SUBTRONICS and 4 more". */
export function warmupLine(w: Warmup): string {
  const names = w.artists.map((a) => a.name);
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}
