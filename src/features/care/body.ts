/**
 * Your body on a festival night, pure: a pulse check you tap along to (no
 * signal or sensors needed), and steps turned into distance. Not medical
 * advice: it only says when a number is a reason to get help.
 */

/** Taps needed before a pulse is shown. */
export const PULSE_TAPS = 8;
/** Taps further apart than this start a new count. */
export const TAP_GAP_MS = 2500;

/** Beats per minute from the times you tapped (the median gap of the latest taps), once there are enough. */
export function bpmFromTaps(taps: readonly number[]): number | undefined {
  const recent = taps.slice(-12);
  if (recent.length < PULSE_TAPS) return undefined;
  const gaps = recent.slice(1).map((t, i) => t - recent[i]).filter((g) => g >= 250 && g <= 2000);
  if (gaps.length < PULSE_TAPS - 2) return undefined;
  const sorted = [...gaps].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  return Math.round(60_000 / mid);
}

/** Taps since the last long pause (a pause starts a new count). */
export function currentTaps(taps: readonly number[], now: number): number[] {
  const out: number[] = [];
  for (const t of taps) {
    if (out.length && t - out[out.length - 1] > TAP_GAP_MS) out.length = 0;
    out.push(t);
  }
  return out.length && now - out[out.length - 1] > TAP_GAP_MS ? [] : out;
}

export type PulseNote = { tone: 'ok' | 'watch' | 'help'; line: string };

/** What a resting pulse means, plainly. */
export function pulseNote(bpm: number): PulseNote {
  if (bpm >= 120)
    return { tone: 'help', line: 'That’s fast. If you’ve been resting and it stays this fast, or you feel very hot, faint or have chest pain, get help now.' };
  if (bpm >= 100) return { tone: 'watch', line: 'A bit fast. Sit somewhere cool for 10 minutes, sip water, and check again.' };
  if (bpm < 50) return { tone: 'watch', line: 'That’s slow. If you feel faint, confused or very sleepy, get help.' };
  return { tone: 'ok', line: 'That’s in the usual resting range.' };
}

/** About 0.75 m a step at a festival's shuffle. */
const STEP_M = 0.75;

/** "12,480 steps · about 9.4 km" (or miles where the locale uses them). */
export function stepsLine(steps: number, miles: boolean): string {
  const km = (steps * STEP_M) / 1000;
  const dist = miles ? `${(km / 1.609).toFixed(1)} mi` : `${km.toFixed(1)} km`;
  return `${steps.toLocaleString('en-US')} ${steps === 1 ? 'step' : 'steps'} · about ${dist}`;
}
