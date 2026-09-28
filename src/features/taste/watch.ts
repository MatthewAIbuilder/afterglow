/**
 * How you watched a clip, read from which parts of it actually played while
 * it was on screen. Pure, so the rules are easy to test.
 *
 * - quick: you swiped away within the first few seconds.
 * - through: you watched (nearly) all of it.
 * - replayed: you watched it all, then most of it again.
 *
 * Anything in between says nothing either way. Merely loading a clip says
 * nothing, and neither does playback that happened hidden or in the
 * background: the player only reports time that played while the clip was
 * live (see ClipPlayer.onPlayed), and only those reports reach a session.
 *
 * A session tracks coverage, not a running total: the same seconds reported
 * twice, or watched again after seeking back, never count twice within a
 * pass. A new pass only starts once the current one is complete.
 */
export type Watch = 'quick' | 'through' | 'replayed';

export const WATCHES: readonly Watch[] = ['quick', 'through', 'replayed'];

export const isWatch = (w: unknown): w is Watch => typeof w === 'string' && (WATCHES as readonly string[]).includes(w);

/** Share of the clip that counts as watching it to the end (the last beat is easy to miss). */
export const THROUGH_SHARE = 0.9;
/** Share of a second pass that counts as watching it again. */
export const REPLAY_SHARE = 0.5;
/** A quick pass: at least this much played (so you actually saw it)... */
export const QUICK_MIN_SEC = 1;
/** ...but less than this before you swiped away. */
export const QUICK_MAX_SEC = 4;
/** A single report longer than this is a seek or a stall, not playback. */
export const MAX_SPAN_SEC = 2;

type Span = readonly [number, number];

export type WatchSession = {
  /** Length of the clip in seconds. */
  lengthSec: number;
  /** Merged parts of the clip (seconds into it) that played in the current pass. */
  covered: readonly Span[];
  /** Passes watched to the end. */
  passes: number;
  /** Seconds that actually played, all passes together. */
  playedSec: number;
  /**
   * Something other than a swipe interrupted this watch (you opened the
   * artist, or left Discover mid-clip), so a short watch says nothing.
   */
  excused: boolean;
};

export function startWatch(lengthSec: number): WatchSession {
  return { lengthSec: lengthSec > 0 ? lengthSec : 0, covered: [], passes: 0, playedSec: 0, excused: false };
}

export function excuseWatch(s: WatchSession): WatchSession {
  return s.excused ? s : { ...s, excused: true };
}

/** Total seconds covered by merged spans. */
export function coveredSec(spans: readonly Span[]) {
  return spans.reduce((sum, [a, b]) => sum + (b - a), 0);
}

function mergeSpan(spans: readonly Span[], add: Span): Span[] {
  const all = [...spans, add].sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  for (const [a, b] of all) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/**
 * Add a stretch of real playback, from and to in seconds into the clip.
 * Invalid, backwards or too-long stretches (seeks, loops, stalls) are ignored.
 */
export function addPlayed(s: WatchSession, from: number, to: number): WatchSession {
  if (!(s.lengthSec > 0) || !Number.isFinite(from) || !Number.isFinite(to)) return s;
  if (to - from > MAX_SPAN_SEC) return s;
  const a = Math.max(0, from);
  const b = Math.min(s.lengthSec, to);
  if (!(b > a)) return s;

  let covered = mergeSpan(s.covered, [a, b]);
  let passes = s.passes;
  if (coveredSec(covered) >= s.lengthSec * THROUGH_SHARE) {
    passes += 1;
    covered = [];
  }
  return { ...s, covered, passes, playedSec: s.playedSec + (b - a) };
}

/** What a finished session says, if anything. */
export function watchOf(s: WatchSession): Watch | undefined {
  if (s.passes >= 2 || (s.passes === 1 && coveredSec(s.covered) >= s.lengthSec * REPLAY_SHARE)) return 'replayed';
  if (s.passes === 1) return 'through';
  if (!s.excused && s.playedSec >= QUICK_MIN_SEC && s.playedSec < QUICK_MAX_SEC) return 'quick';
  return undefined;
}

const RANK: Record<Watch, number> = { quick: 0, through: 1, replayed: 2 };

/**
 * Fold a new watch into what a clip already has. The strongest watch wins, so
 * a later quick swipe never undoes a full watch, and watching it through again
 * on a later visit counts as a replay. It can never go beyond "replayed", so
 * coming back to a clip over and over can't pile up signal.
 */
export function mergeWatch(prev: Watch | undefined, next: Watch | undefined): Watch | undefined {
  if (!prev) return next;
  if (!next) return prev;
  if (prev !== 'quick' && next !== 'quick') return 'replayed';
  return RANK[next] > RANK[prev] ? next : prev;
}
