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
export type Pace = { bob: number; sway: number; blink: number; twinkle: number; phase: number; wanders: number };

export function paceOf(id: string): Pace {
  const h = hashOf(id);
  return {
    // Bobs every 3.4 to 4.8 s, sways every 3 to 4 s, blinks every 2.7 to 3.4 s.
    bob: 5 + (h % 3),
    sway: 6 + ((h >>> 3) % 3),
    blink: 7 + ((h >>> 6) % 3),
    twinkle: 11 + ((h >>> 9) % 3),
    phase: ((h >>> 12) % 1000) / 1000,
    // A stroll in 3 to 5 legs a loop (each leg 2.4 to 4 s: a walk, then a look around).
    wanders: 3 + ((h >>> 22) % 3),
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

/** How far a creature wanders from its spot: a share of its column's width, and a little up and down the meadow. */
export const WANDER_X = 0.3;
export const WANDER_Y = 0.16;

const ease = (u: number) => {
  'worklet';
  return u * u * (3 - 2 * u);
};

/**
 * Where a creature has wandered to (each -1 to 1, around its spot) and
 * whether it's walking (0 resting, 1 mid-stride), from the garden's clock:
 * it strolls one way, stops to look around, strolls on, a different route
 * for each creature (`wanders` legs a loop, its own phase), and comes back
 * to where it started by the end of the loop, so the loop joins up.
 */
export function wander(t: number, wanders: number, phase: number): { x: number; y: number; walking: number } {
  'worklet';
  const legs = wanders * 2;
  const u = (t + phase) % 1;
  const leg = Math.floor(u * legs);
  const f = u * legs - leg;
  // Each leg: walk for the first 60%, then stand still.
  const walk = f < 0.6 ? f / 0.6 : 1;
  const walking = f < 0.6 ? Math.sin(Math.PI * walk) : 0;
  // Waypoints round a closed loop: leg k goes from point k to point k+1.
  const point = (k: number) => {
    const a = (k / legs) * Math.PI * 2 + phase * 6.28;
    return { x: Math.sin(a * 1.0 + phase * 3) * 0.95, y: Math.sin(a * 2.0 + phase * 5) * 0.8 };
  };
  const p = point(leg);
  const q = point(leg + 1);
  const e = ease(walk);
  return { x: p.x + (q.x - p.x) * e, y: p.y + (q.y - p.y) * e, walking };
}
