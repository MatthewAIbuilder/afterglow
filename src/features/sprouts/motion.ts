import { hashOf } from './artistLook';

/**
 * How the garden keeps time. One clock (a shared value running 0 → 1 over
 * `CLOCK_MS`, again and again) drives every creature: each reads it with its
 * own pace and phase, so nothing moves in step and there's one animation
 * running instead of one per creature. Every pace is a whole number of
 * cycles per loop, so the loop joins up with no jump. These run on the UI
 * thread (worklets).
 */
export const CLOCK_MS = 24000;
const TAU = Math.PI * 2;

/** A creature's own timing: cycles per loop for its bob, sway, blink and twinkle, and where in the loop it starts. */
export type Pace = { bob: number; sway: number; blink: number; twinkle: number; phase: number };

export function paceOf(id: string): Pace {
  const h = hashOf(id);
  return {
    // Bobs every 3.4 to 4.8 s, sways every 3 to 4 s, blinks every 2.7 to 3.4 s.
    bob: 5 + (h % 3),
    sway: 6 + ((h >>> 3) % 3),
    blink: 7 + ((h >>> 6) % 3),
    twinkle: 11 + ((h >>> 9) % 3),
    phase: ((h >>> 12) % 1000) / 1000,
  };
}

/** A gentle back and forth (-1 to 1) at `cycles` per loop, starting `phase` of the way in. */
export function sine(t: number, cycles: number, phase: number): number {
  'worklet';
  return Math.sin(TAU * (t * cycles + phase));
}

/** Eyes open (1), shutting for a moment `cycles` times a loop (about 135 ms when the loop is 24 s). */
export function blinkOf(t: number, cycles: number, phase: number): number {
  'worklet';
  const u = (t * cycles + phase) % 1;
  return u < 0.045 ? 1 - 0.94 * Math.sin((Math.PI * u) / 0.045) : 1;
}

/** A glance to the side (0 to 1) twice a loop, each lasting about a second. */
export function glanceOf(t: number, phase: number): number {
  'worklet';
  const u = (t * 2 + phase * 0.37) % 1;
  return u < 0.09 ? Math.sin((Math.PI * u) / 0.09) : 0;
}
