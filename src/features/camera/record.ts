import type { Festival } from '../../data/models';
import { festivalNight } from '../plan/live';
import { nextRun } from '../festivals/when';

/**
 * The camera page's rules, pure. The record button works two ways: tap to
 * start and tap again to stop, or hold it down to film only while held.
 * Swiping right on Discover peeks the camera in and opens it past a point.
 */

/** Longest recording: memories are clips. */
export const RECORD_MAX_SEC = 60;
/** Held at least this long, letting go stops; a shorter press starts a tap-to-stop recording. */
export const HOLD_MS = 350;
/** Anything shorter is a slip of the finger, not a clip. */
export const MIN_RECORD_MS = 800;

export type RecordState =
  | { phase: 'idle' }
  /** `mode`: still deciding (finger down), held (stops on release) or tapped (stops on the next tap). */
  | { phase: 'recording'; startedAt: number; pressedAt: number; mode: 'pending' | 'tap' | 'tap-down' };

export type RecordEvent = { type: 'press-in' | 'press-out'; at: number };

export const IDLE: RecordState = { phase: 'idle' };

/** The next state of the button, and whether recording should start or stop. */
export function recordButton(state: RecordState, e: RecordEvent): { state: RecordState; action?: 'start' | 'stop' } {
  if (state.phase === 'idle') {
    if (e.type !== 'press-in') return { state };
    return { state: { phase: 'recording', startedAt: e.at, pressedAt: e.at, mode: 'pending' }, action: 'start' };
  }
  if (e.type === 'press-in') return state.mode === 'tap' ? { state: { ...state, pressedAt: e.at, mode: 'tap-down' } } : { state };
  // Letting go.
  if (state.mode === 'pending') {
    if (e.at - state.pressedAt >= HOLD_MS) return { state: IDLE, action: 'stop' };
    return { state: { ...state, mode: 'tap' } };
  }
  if (state.mode === 'tap-down') return { state: IDLE, action: 'stop' };
  return { state };
}

/** How full the ring is: 0 to 1 of the longest recording. */
export const recordProgress = (elapsedMs: number) => Math.min(1, Math.max(0, elapsedMs / (RECORD_MAX_SEC * 1000)));

/** "0:07", "2:15". */
export function elapsedLabel(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** How far you drag before the camera opens, as a share of the screen width. */
export const OPEN_AT = 0.35;
/** A quick flick opens it sooner. */
export const FLICK_SPEED = 700;
/** How far Discover shifts over while you drag. */
export const PEEK_MAX = 110;

/** Whether letting go after dragging right this far, this fast, opens the camera. */
export const swipeOpens = (dx: number, vx: number, width: number) => dx > width * OPEN_AT || (vx > FLICK_SPEED && dx > 48);

/** "Filming at Cyclops Cove 4 · Friday": a festival you're going to that's on today (its night, when known). */
export function filmingAt(festivals: readonly Festival[], going: readonly string[], now: Date): string | undefined {
  const on = festivals.find((f) => going.includes(f.id) && (nextRun(f, now)?.until ?? 1) <= 0);
  if (!on) return undefined;
  const night = festivalNight(on, now)?.day;
  return night ? `${on.name} · ${night}` : on.name;
}
