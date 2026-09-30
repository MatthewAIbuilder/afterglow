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
 * - Part of that signal spills over to artists with a similar sound, which is
 *   how the map learns about artists you have not seen yet.
 * - Changes shrink near the edges: a 98% match barely moves on another like,
 *   a 42% match moves a lot.
 * - A connected music library (Spotify, Apple Music) is a separate imported
 *   layer, kept apart from what you do in Afterglow so the two can be tuned
 *   independently. It gives a new listener a head start and never more:
 *   everything it says about one artist (their own library strength, spill
 *   from similar library artists, and the sounds of library artists Afterglow
 *   doesn't have) is capped at `IMPORT_CAP`, below a single like, and counts
 *   half once you've reacted to or rated that artist here. A skip in
 *   Afterglow outweighs a whole library's worth of plays.
 */

export const WEIGHT = { like: 1, save: 1.3, skip: -0.8 };
/** Rating an artist directly: as strong as saving or skipping one of their clips. */
export const RATING_WEIGHT = { love: 1.3, pass: -0.8 } as const;
/** What a direct rating says about the artist themselves: love is at least this, pass at most this. */
export const RATED = { love: 0.8, pass: 0.3 } as const;
/** Passive watch signals, one per clip at most. */
export const WATCH_WEIGHT: Record<Watch, number> = { through: 0.3, replayed: 0.5, quick: -0.2 };
/** Bounds on all passive signal for one artist, however many clips you watch. */
export const WATCH_CAP = { up: 0.6, down: -0.3 };
/** A library strength of 1 (followed, many saved songs, played a lot) counts this much: below one like. */
export const IMPORT_WEIGHT = 0.6;
/** Once you've reacted to or rated an artist in Afterglow, their library signal counts this share. */
export const IMPORT_OWN_SHARE = 0.5;
/** All imported signal for one artist, from every source, is at most this. */
export const IMPORT_CAP = 0.6;
/** Library artists Afterglow doesn't have count this share, through their sound only... */
export const IMPORT_SOUND_SHARE = 0.5;
/** ...reaching only artists at least this alike... */
export const IMPORT_SOUND_MIN_SIMILARITY = 0.5;
/** ...and adding at most this to any one artist. */
export const IMPORT_SOUND_CAP = 0.3;

/**
 * What a connected music library says, already matched to the catalogue
 * (see features/music/imported.ts). Empty changes nothing.
 */
export type ImportedTaste = {
  /** Afterglow artist id -> library strength, 0 to 1. */
  artists: Record<string, number>;
  /** Library artists Afterglow doesn't have, as the sounds they carry and how strongly you like them. */
  sounds: { sound: Artist['sound']; strength: number }[];
};
const NO_IMPORT: ImportedTaste = { artists: {}, sounds: [] };

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
  /** A connected music library, matched to the catalogue. */
  imported: ImportedTaste = NO_IMPORT,
): {
  taste: TasteProfile;
  summary: TasteSummary;
  informed: Record<string, boolean>;
  /** The imported layer's share of each artist's signal (only artists it reached). */
  imported: Record<string, number>;
} {
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

  // The imported layer: its own signal, spill and cap, added on top.
  const fromLibrary = importedSignal(artists, imported, direct, similarity);
  for (const [id, s] of Object.entries(fromLibrary)) signal[id] += s;

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
  return { taste, summary, informed, imported: fromLibrary };
}

/**
 * The imported layer for every artist it reaches, each within
 * [0, IMPORT_CAP]. `own` holds artists you've reacted to or rated here.
 */
function importedSignal(
  artists: Artist[],
  imported: ImportedTaste,
  own: Record<string, number>,
  similarity: Similarity,
): Record<string, number> {
  const byId = new Map(artists.map((a) => [a.id, a]));
  const direct: Record<string, number> = {};
  for (const [id, strength] of Object.entries(imported.artists)) {
    if (!byId.has(id) || !(strength > 0)) continue;
    direct[id] = Math.min(1, strength) * IMPORT_WEIGHT * (id in own ? IMPORT_OWN_SHARE : 1);
  }
  const sources = Object.keys(direct);
  if (!sources.length && !imported.sounds.length) return {};
  const out: Record<string, number> = {};
  for (const a of artists) {
    let s = direct[a.id] ?? 0;
    for (const id of sources) {
      if (id === a.id) continue;
      const sim = similarity(a, byId.get(id)!);
      if (sim >= SPILL_MIN_SIMILARITY) s += direct[id] * sim * SPILL;
    }
    let bySound = 0;
    for (const v of imported.sounds) {
      const sim = soundSimilarity(a, { id: '', name: '', sound: v.sound });
      if (sim >= IMPORT_SOUND_MIN_SIMILARITY) bySound += Math.min(1, v.strength) * IMPORT_WEIGHT * IMPORT_SOUND_SHARE * sim * SPILL;
    }
    s += Math.min(IMPORT_SOUND_CAP, bySound);
    if (a.id in own) s = Math.min(s, IMPORT_CAP * IMPORT_OWN_SHARE);
    s = Math.min(IMPORT_CAP, s);
    if (s > 0) out[a.id] = s;
  }
  return out;
}
