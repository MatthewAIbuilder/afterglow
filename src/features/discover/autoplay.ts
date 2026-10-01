/**
 * Playing the next clip by itself: once you've watched a clip to its end,
 * Discover counts down briefly and glides to the next one, unless you tap
 * Stay (then it loops as before). Only real watching counts: a pass is
 * finished when the player reports live, playing seconds near the clip's
 * end (or the stage's clock reaches it), never while paused or hidden. Pure.
 */

/** How long the "Next clip in…" pill counts down before moving on. */
export const AUTOPLAY_COUNTDOWN_SEC = 3;
/** How close to the end a played stretch must reach for the pass to count as finished (players report in ticks). */
export const FINISH_SLACK_SEC = 1.5;

/** A played stretch ending at `to` seconds into a clip of `lengthSec` finishes a pass. */
export const passFinished = (to: number, lengthSec: number) => lengthSec > 0 && to >= lengthSec - FINISH_SLACK_SEC;

/** One step of the countdown: the seconds left after a tick, or 'next' when it's time to move on. */
export const countdownTick = (left: number): number | 'next' => (left <= 1 ? 'next' : left - 1);

export const upNextLabel = (left: number) => `Next clip in ${left}`;
export const upNextA11y = (left: number) => `Next clip in ${left} ${left === 1 ? 'second' : 'seconds'}. Tap to stay on this one.`;
