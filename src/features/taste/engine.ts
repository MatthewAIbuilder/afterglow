import type { Artist, Clip, TasteProfile } from '../../data/types';
import type { Reaction } from '../../state/reactions';
import { soundSimilarity } from '../sound-map/layout';

/**
 * Taste engine, version one. Pure and deterministic, so it is easy to reason
 * about and to replace with a real model later.
 *
 * - Every reaction is a signal for that clip's artist: likes and saves push
 *   the match up, skips push it down.
 * - Part of that signal spills over to artists with a similar sound, which is
 *   how the map learns about artists you have not seen yet.
 * - Changes shrink near the edges: a 98% match barely moves on another like,
 *   a 42% match moves a lot.
 */

const WEIGHT = { like: 1, save: 1.3, skip: -0.8 };
const STEP = 0.11; // how much one signal moves a mid-range match
const SPILL = 0.45; // share of a signal that reaches similar artists
const SPILL_MIN_SIMILARITY = 0.3;
const FLOOR = 0.05;
const CEILING = 0.99;

export type TasteSummary = { likes: number; saves: number; skips: number };

export function computeTaste(
  base: TasteProfile,
  artists: Artist[],
  clips: Clip[],
  reactions: Record<string, Reaction>,
): { taste: TasteProfile; summary: TasteSummary } {
  const clipById = new Map(clips.map((c) => [c.id, c]));
  const direct: Record<string, number> = {};
  const summary: TasteSummary = { likes: 0, saves: 0, skips: 0 };

  for (const [clipId, r] of Object.entries(reactions)) {
    const clip = clipById.get(clipId);
    if (!clip) continue;
    let s = 0;
    if (r.liked) {
      s += WEIGHT.like;
      summary.likes++;
    }
    if (r.saved) {
      s += WEIGHT.save;
      summary.saves++;
    }
    if (r.skipped && !r.liked) {
      s += WEIGHT.skip;
      summary.skips++;
    }
    direct[clip.artistId] = (direct[clip.artistId] ?? 0) + s;
  }

  // Direct signal plus spill-over from similar artists.
  const signal: Record<string, number> = {};
  for (const a of artists) {
    let s = direct[a.id] ?? 0;
    for (const b of artists) {
      if (b.id === a.id || !direct[b.id]) continue;
      const sim = soundSimilarity(a, b);
      if (sim >= SPILL_MIN_SIMILARITY) s += direct[b.id] * sim * SPILL;
    }
    signal[a.id] = s;
  }

  const taste: TasteProfile = {};
  for (const a of artists) {
    const start = base[a.id] ?? 0.5;
    const s = signal[a.id];
    // Room to move shrinks as you approach 0% or 100%.
    const room = s >= 0 ? 1 - start : start;
    const next = start + Math.tanh(s * STEP * 2) * room * 0.9;
    taste[a.id] = Math.min(CEILING, Math.max(FLOOR, next));
  }
  return { taste, summary };
}
