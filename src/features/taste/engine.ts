import type { Artist, Clip, TasteProfile } from '../../data/types';
import type { Reaction } from '../../state/reactions';
import { type Similarity, soundSimilarity } from './similarity';
import { isRating, type Ratings } from './ratings';
import { isWatch, type Watch } from './watch';

/**
 * Taste engine, version one. Pure and deterministic, so it is easy to reason
 * about and to replace with a real model later.
 *
 * - Every reaction is a signal for that clip's artist: likes and saves push
 *   the match up, skips push it down.
 * - How you watch is a quieter, passive signal: watching a clip through or
 *   replaying it nudges the artist up, swiping away in the first seconds
 *   nudges them down. A skip cancels the watch on that clip, and a like or
 *   save cancels a quick swipe. Passive signal per artist is capped below a
 *   single like or skip, so watching can never outweigh what you tap.
 * - Rating an artist directly ("love their sound", "not for me") counts like
 *   a save or a skip on one of their clips for the similar sounds it spills
 *   over to. For the artist themselves it's a clear answer: someone you love
 *   is at least a strong match (`RATED.love`), someone you pass on is left
 *   out of your plan (`RATED.pass`). It's how a lineup with no clips gets
 *   learned.
 * - Following an artist is a standing "I'm into them": a little less than a
 *   like (`FOLLOW_WEIGHT`), spilling over like one.
 * - Part of that signal spills over to artists with a similar sound, which is
 *   how the map learns about artists you have not seen yet.
 * - Changes shrink near the edges: a 98% match barely moves on another like,
 *   a 42% match moves a lot.
 */

export const WEIGHT = { like: 1, save: 1.3, skip: -0.8 };
/** Rating an artist directly: as strong as saving or skipping one of their clips. */
export const RATING_WEIGHT = { love: 1.3, pass: -0.8 } as const;
/** What a direct rating says about the artist themselves: love is at least this, pass at most this. */
export const RATED = { love: 0.8, pass: 0.3 } as const;
/** Following an artist: a little less than a like, since you might follow someone just for news of them. */
export const FOLLOW_WEIGHT = 0.6;
/** Passive watch signals, one per clip at most. */
export const WATCH_WEIGHT: Record<Watch, number> = { through: 0.3, replayed: 0.5, quick: -0.2 };
/** Bounds on all passive signal for one artist, however many clips you watch. */
export const WATCH_CAP = { up: 0.6, down: -0.3 };
const STEP = 0.11; // how much one signal moves a mid-range match
const SPILL = 0.45; // share of a signal that reaches similar artists
const SPILL_MIN_SIMILARITY = 0.3;
const FLOOR = 0.05;
const CEILING = 0.99;

/** watched: clips you watched through or replayed (and didn't skip). */
export type TasteSummary = { likes: number; saves: number; skips: number; watched: number };

export function computeTaste(
  base: TasteProfile,
  artists: Artist[],
  clips: Clip[],
  reactions: Record<string, Reaction>,
  /** How alike two artists are. Sound tags by default; a catalogue can supply better. */
  similarity: Similarity = soundSimilarity,
  /** Artists rated directly, without a clip. */
  ratings: Ratings = {},
  /** Artists you follow. */
  follows: readonly string[] = [],
): { taste: TasteProfile; summary: TasteSummary; informed: Record<string, boolean> } {
  const clipById = new Map(clips.map((c) => [c.id, c]));
  const direct: Record<string, number> = {};
  const passive: Record<string, number> = {};
  const summary: TasteSummary = { likes: 0, saves: 0, skips: 0, watched: 0 };

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

    const w = isWatch(r.watched) ? r.watched : undefined;
    // A skip already said no; a like or save outweighs a quick swipe.
    if (w && !r.skipped && !(w === 'quick' && (r.liked || r.saved))) {
      passive[clip.artistId] = (passive[clip.artistId] ?? 0) + WATCH_WEIGHT[w];
      if (w !== 'quick') summary.watched++;
    }
  }
  const known = new Set(artists.map((a) => a.id));
  for (const [id, r] of Object.entries(ratings)) {
    if (known.has(id) && isRating(r)) direct[id] = (direct[id] ?? 0) + RATING_WEIGHT[r];
  }
  for (const id of new Set(follows)) {
    if (known.has(id)) direct[id] = (direct[id] ?? 0) + FOLLOW_WEIGHT;
  }
  for (const [id, p] of Object.entries(passive)) {
    direct[id] = (direct[id] ?? 0) + Math.min(WATCH_CAP.up, Math.max(WATCH_CAP.down, p));
  }

  // Direct signal plus spill-over from similar artists.
  const signal: Record<string, number> = {};
  for (const a of artists) {
    let s = direct[a.id] ?? 0;
    for (const b of artists) {
      if (b.id === a.id || !direct[b.id]) continue;
      const sim = similarity(a, b);
      if (sim >= SPILL_MIN_SIMILARITY) s += direct[b.id] * sim * SPILL;
    }
    signal[a.id] = s;
  }

  const taste: TasteProfile = {};
  // Whether a match rests on anything real (a starting prediction or your reactions), or is only the default guess.
  const informed: Record<string, boolean> = {};
  for (const a of artists) {
    informed[a.id] = a.id in base || signal[a.id] !== 0;
    const start = base[a.id] ?? 0.5;
    const s = signal[a.id];
    // Room to move shrinks as you approach 0% or 100%.
    const room = s >= 0 ? 1 - start : start;
    const next = start + Math.tanh(s * STEP * 2) * room * 0.9;
    taste[a.id] = Math.min(CEILING, Math.max(FLOOR, next));
    // You said so yourself: a love is never below a strong match, a pass never above "not for you".
    const rated = ratings[a.id];
    if (rated === 'love') taste[a.id] = Math.max(taste[a.id], RATED.love);
    else if (rated === 'pass') taste[a.id] = Math.min(taste[a.id], RATED.pass);
  }
  return { taste, summary, informed };
}
