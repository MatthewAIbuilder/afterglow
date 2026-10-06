import type { Artist, Clip, TasteProfile } from '../../data/types';
import type { Reaction } from '../../state/reactions';
import { type Similarity, soundSimilarity } from './similarity';
import { isRating, type Rating, type Ratings } from './ratings';
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
 * - Rating an artist directly (Love them, Like them, They're OK, Not really,
 *   Not for me) counts from a save down to a skip on one of their clips for
 *   the similar sounds it spills over to (`RATING_WEIGHT`). For the artist
 *   themselves it's a clear answer that keeps them in a range
 *   (`RATED_RANGE`): someone you love is at least a strong match, someone
 *   you pass on is left out of your plan. It's how a lineup with no clips
 *   gets learned.
 * - Part of that signal spills over to artists with a similar sound, which is
 *   how the map learns about artists you have not seen yet.
 * - Changes shrink near the edges: a 98% match barely moves on another like,
 *   a 42% match moves a lot.
 * - A connected music library (Spotify, Apple Music) is a separate imported
 *   layer, kept apart from what you do in Afterglow so the two can be tuned
 *   independently. It gives a new listener a head start and never more:
 *   everything it says about one artist (their own library strength, plus
 *   spill from similar library artists and the sounds of library artists
 *   Afterglow doesn't have, itself capped at `IMPORT_SPILL_CAP`) is at most
 *   `IMPORT_CAP`, below a single like, and counts half once you've reacted to
 *   or rated that artist here. A skip in Afterglow outweighs a whole
 *   library's worth of plays.
 */

export const WEIGHT = { like: 1, save: 1.3, skip: -0.8 };
/**
 * Rating an artist directly, for the similar sounds it spills over to: love
 * as strong as saving one of their clips, not for me as a skip, and the steps
 * between in proportion ("They're OK" says nothing about anyone else).
 */
export const RATING_WEIGHT: Record<Rating, number> = { love: 1.3, like: 0.7, ok: 0, meh: -0.4, pass: -0.8 };
/** What a direct rating says about the artist themselves: love is at least this, pass at most this. */
export const RATED = { love: 0.8, pass: 0.3 } as const;
/**
 * Where each answer puts the artist, whatever else says otherwise: [at least,
 * at most]. Love and like reach your plan, OK sits among things to explore,
 * not really and not for me leave it.
 */
export const RATED_RANGE: Record<Rating, readonly [number, number]> = {
  love: [RATED.love, 1],
  like: [0.7, 1],
  ok: [0.4, 0.7],
  meh: [0, 0.4],
  pass: [0, RATED.pass],
};
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
 * Everything that reaches an artist only by sounding like your library
 * (similar library artists, and sounds of ones Afterglow doesn't have) is at
 * most this: half the cap, so an artist who merely sounds like your library
 * never matches one who is in it. Without it, a big library spilled every
 * similar act up to the same cap as your actual favourite.
 */
export const IMPORT_SPILL_CAP = 0.3;

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

/**
 * A connected library that gives Afterglow at least this many of its own
 * artists replaces the built-in starting guess (see `startingPrior`).
 */
export const PRIOR_YIELDS_AT = 3;

/**
 * The starting profile the engine begins from. Everyone starts from the
 * built-in guess (`base`) so a newcomer's map isn't empty, but that guess is
 * made up, not about you. Once a connected library names at least
 * `PRIOR_YIELDS_AT` Afterglow artists, it steps aside and every match starts
 * at an even 50%: your library then decides who leads the map, instead of
 * trailing behind guesses that outrank it (a house fan's own favourite would
 * otherwise sit below five bass acts they've never played). The library's own
 * weight is unchanged, so one like or skip still counts for more than it, and
 * disconnecting brings the guess back.
 */
export function startingPrior(base: TasteProfile, imported: ImportedTaste = NO_IMPORT): TasteProfile {
  const named = Object.values(imported.artists).filter((s) => s > 0).length;
  return named >= PRIOR_YIELDS_AT ? {} : base;
}

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
  /**
   * Back to backs (data/b2b.ts): everyone playing in a clip, so a reaction counts for each of
   * them, and a b2b act's artists, so an act you haven't reacted to matches like its best-liked artist.
   */
  b2b: { playersOf: (clip: Clip) => readonly string[]; membersOf: (artistId: string) => readonly string[] } = NO_B2B,
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
    // A back to back is a set by each of them: it counts for every artist playing.
    const players = b2b.playersOf(clip);
    for (const id of players) direct[id] = (direct[id] ?? 0) + s;

    const w = isWatch(r.watched) ? r.watched : undefined;
    // A skip already said no; a like or save outweighs a quick swipe.
    if (w && !r.skipped && !(w === 'quick' && (r.liked || r.saved))) {
      for (const id of players) passive[id] = (passive[id] ?? 0) + WATCH_WEIGHT[w];
      if (w !== 'quick') summary.watched++;
    }
  }
  const known = new Set(artists.map((a) => a.id));
  for (const [id, r] of Object.entries(ratings)) {
    if (known.has(id) && isRating(r)) direct[id] = (direct[id] ?? 0) + RATING_WEIGHT[r];
  }
  // What you said yourself (reactions and ratings), before quieter watch behaviour joins it.
  const explicit: Record<string, number> = { ...direct };
  for (const [id, p] of Object.entries(passive)) {
    direct[id] = (direct[id] ?? 0) + Math.min(WATCH_CAP.up, Math.max(WATCH_CAP.down, p));
  }

  // Direct signal plus spill-over from similar artists. Only artists with a signal can spill, so each
  // pass looks at those alone (in catalogue order, so the sums come out exactly as before), not at
  // every artist for every artist: with thousands of artists that was millions of steps on each start.
  const withSignal = new Map<Record<string, number>, Artist[]>();
  const sourcesOf = (from: Record<string, number>) => {
    let list = withSignal.get(from);
    if (!list) {
      list = artists.filter((b) => from[b.id]);
      withSignal.set(from, list);
    }
    return list;
  };
  const spilled = (from: Record<string, number>, a: (typeof artists)[number]) => {
    let s = from[a.id] ?? 0;
    for (const b of sourcesOf(from)) {
      if (b.id === a.id) continue;
      const sim = similarity(a, b);
      if (sim >= SPILL_MIN_SIMILARITY) s += from[b.id] * sim * SPILL;
    }
    return s;
  };
  const signal: Record<string, number> = {};
  for (const a of artists) {
    const all = spilled(direct, a);
    // Passive signal never outweighs explicit: watching similar artists can't lift one you skipped or passed on
    // above where what you said put it.
    signal[a.id] = (explicit[a.id] ?? 0) < 0 ? Math.min(all, spilled(explicit, a)) : all;
  }

  // The imported layer: its own signal, spill and cap, added on top.
  const fromLibrary = importedSignal(artists, imported, direct, similarity);
  for (const [id, s] of Object.entries(fromLibrary)) signal[id] += s;

  const taste: TasteProfile = {};
  // Whether a match rests on anything real (a starting prediction or your reactions), or is only the default guess.
  const informed: Record<string, boolean> = {};
  for (const a of artists) {
    // Rated at all (even "They're OK") means you've told us: it's no longer a guess.
    informed[a.id] = a.id in base || signal[a.id] !== 0 || isRating(ratings[a.id]);
    const start = base[a.id] ?? 0.5;
    const s = signal[a.id];
    // Room to move shrinks as you approach 0% or 100%.
    const room = s >= 0 ? 1 - start : start;
    const next = start + Math.tanh(s * STEP * 2) * room * 0.9;
    taste[a.id] = Math.min(CEILING, Math.max(FLOOR, next));
    // You said so yourself: each answer keeps the artist in its range (a love never below a strong match,
    // a pass never above "not for you", OK in between).
    const rated = ratings[a.id];
    if (isRating(rated)) {
      const [lo, hi] = RATED_RANGE[rated];
      taste[a.id] = Math.min(hi, Math.max(lo, taste[a.id]));
    }
  }
  // A b2b act nobody has said anything about matches like the artist in it you like best.
  for (const a of artists) {
    const members = b2b.membersOf(a.id).filter((m) => m in taste);
    if (!members.length || (explicit[a.id] ?? 0) !== 0 || isRating(ratings[a.id])) continue;
    const best = Math.max(...members.map((m) => (informed[m] ? taste[m] : 0)));
    if (best > taste[a.id]) {
      taste[a.id] = best;
      informed[a.id] = true;
    }
  }
  return { taste, summary, informed, imported: fromLibrary };
}

const NO_B2B = { playersOf: (clip: Clip) => [clip.artistId], membersOf: () => [] };

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
    // Spill from similar library artists, and from the sounds of library artists Afterglow doesn't have.
    let fromArtists = 0;
    for (const id of sources) {
      if (id === a.id) continue;
      const sim = similarity(a, byId.get(id)!);
      if (sim >= SPILL_MIN_SIMILARITY) fromArtists += direct[id] * sim * SPILL;
    }
    let bySound = 0;
    for (const v of imported.sounds) {
      const sim = soundSimilarity(a, { id: '', name: '', sound: v.sound });
      if (sim >= IMPORT_SOUND_MIN_SIMILARITY) bySound += Math.min(1, v.strength) * IMPORT_WEIGHT * IMPORT_SOUND_SHARE * sim * SPILL;
    }
    const spill = Math.min(IMPORT_SPILL_CAP, fromArtists + Math.min(IMPORT_SOUND_CAP, bySound));
    // Spill fills only the room the artist's own library strength leaves, so it never reaches the cap on
    // its own, a stronger library artist always ends higher, and the total stays within IMPORT_CAP.
    const mine = Math.min(IMPORT_CAP, direct[a.id] ?? 0);
    let s = mine + spill * (1 - mine / IMPORT_CAP);
    if (a.id in own) s = Math.min(s, IMPORT_CAP * IMPORT_OWN_SHARE);
    if (s > 0) out[a.id] = s;
  }
  return out;
}
