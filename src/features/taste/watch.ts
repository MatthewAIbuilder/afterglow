/**
 * How you watched a clip, read from how long it actually played while it was
 * on screen. Pure, so the rules are easy to test.
 *
 * - quick: you swiped away within the first few seconds.
 * - through: you watched it to the end.
 * - replayed: you let it play round again.
 *
 * Anything in between says nothing either way.
 */
export type Watch = 'quick' | 'through' | 'replayed';

/** Under this many seconds of playback before swiping away counts as passing on it. */
export const QUICK_SEC = 3;
/** Share of the clip that counts as watching it to the end (the last beat is easy to miss). */
const THROUGH = 0.9;

export function watchFrom(playedSec: number, durationSec: number): Watch | undefined {
  // Nothing played (still loading, or paused straight away): no signal.
  if (!(playedSec > 0) || !(durationSec > 0)) return undefined;
  if (playedSec >= durationSec * (1 + THROUGH)) return 'replayed';
  if (playedSec >= durationSec * THROUGH) return 'through';
  if (playedSec < QUICK_SEC) return 'quick';
  return undefined;
}

const RANK: Record<Watch, number> = { quick: 0, through: 1, replayed: 2 };

/** A clip keeps the strongest way you've watched it, so a later quick swipe never undoes a full watch. */
export function strongerWatch(prev: Watch | undefined, next: Watch | undefined): Watch | undefined {
  if (!prev) return next;
  if (!next) return prev;
  return RANK[next] > RANK[prev] ? next : prev;
}
