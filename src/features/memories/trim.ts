import { MAX_SHARE_BYTES } from '../social/service';

/**
 * Trimming a video to the part worth sharing, pure. A video longer than
 * Discover takes keeps its whole file, with a window (`clip`) saying which
 * part plays: every player starts at `start` and loops at `end`. Afterglow
 * suggests the loudest stretch (usually the drop), and you can move it and
 * change its length, up to CLIP_MAX seconds.
 */
export type ClipWindow = { start: number; end: number };

/** The longest a clip can be, in seconds (the same as the app's camera and picker). */
export const CLIP_MAX = 60;
/** The shortest. */
export const CLIP_MIN = 3;
/** The suggested length for a long video. */
export const CLIP_SUGGESTED = 30;
/** Lengths offered as one tap. */
export const CLIP_LENGTHS = [15, 30, 45, 60] as const;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** What a shared part may weigh: the upload cap, with room to spare (a cut starts at a keyframe, up to a couple of seconds early). */
const PART_BUDGET_BYTES = MAX_SHARE_BYTES * 0.9;
/** Seconds a cut can add around the part (the keyframe before it, a second after it). */
const CUT_MARGIN_SEC = 3;

/**
 * The longest part of a video that can be shared: CLIP_MAX, or less for a big
 * file (a minute of 4K is more than the upload cap, so the part is cut to fit).
 */
export function clipMaxFor(durationSec: number | undefined, bytes: number | undefined): number {
  if (!bytes || !durationSec || !(durationSec > 0)) return CLIP_MAX;
  const perSec = bytes / durationSec;
  return Math.max(CLIP_MIN, Math.min(CLIP_MAX, Math.floor(PART_BUDGET_BYTES / perSec) - CUT_MARGIN_SEC));
}

/** A window kept inside the video and the limits; undefined when there's no sensible one. */
export function clampWindow(w: ClipWindow, durationSec: number, max = CLIP_MAX): ClipWindow | undefined {
  if (!(durationSec > 0) || !Number.isFinite(w.start) || !Number.isFinite(w.end)) return undefined;
  const length = Math.min(max, Math.max(Math.min(CLIP_MIN, durationSec), w.end - w.start), durationSec);
  const start = Math.min(Math.max(0, w.start), durationSec - length);
  return { start: round1(start), end: round1(start + length) };
}

/** Does this window play the whole video (so there's nothing to trim)? */
export const isWhole = (w: ClipWindow | undefined, durationSec: number) => !w || (w.start <= 0.05 && w.end >= durationSec - 0.05);

/** A video longer than it can be shared whole (CLIP_MAX, or less for a big file) has to be trimmed first. */
export const needsTrim = (durationSec: number | undefined, bytes?: number) => !!durationSec && durationSec > clipMaxFor(durationSec, bytes) + 1;

/**
 * The suggested window: the loudest `length` seconds, from the sound's
 * loudness in equal slices across the video (any number of slices); the
 * start when there's no sound to go by.
 */
export function suggestWindow(durationSec: number, loudness: readonly number[] | undefined, length = CLIP_SUGGESTED, max = CLIP_MAX): ClipWindow | undefined {
  if (!(durationSec > 0)) return undefined;
  const len = Math.min(length, durationSec, max);
  if (!loudness?.length || durationSec <= len) return clampWindow({ start: 0, end: len }, durationSec, max);
  const per = durationSec / loudness.length;
  const span = Math.max(1, Math.round(len / per));
  let best = 0;
  let bestSum = -Infinity;
  let sum = 0;
  for (let i = 0; i < loudness.length; i++) {
    sum += loudness[i] || 0;
    if (i >= span) sum -= loudness[i - span] || 0;
    if (i >= span - 1 && sum > bestSum) {
      bestSum = sum;
      best = i - span + 1;
    }
  }
  if (!(bestSum > 0)) return clampWindow({ start: 0, end: len }, durationSec, max);
  return clampWindow({ start: best * per, end: best * per + len }, durationSec, max);
}

/** A new length, keeping the window's middle where it was. */
export function withLength(w: ClipWindow, length: number, durationSec: number, max = CLIP_MAX): ClipWindow | undefined {
  const mid = (w.start + w.end) / 2;
  return clampWindow({ start: mid - length / 2, end: mid + length / 2 }, durationSec, max);
}

/** The window moved by `by` seconds (or to `start`), the same length. */
export const movedTo = (w: ClipWindow, start: number, durationSec: number, max = CLIP_MAX) => clampWindow({ start, end: start + (w.end - w.start) }, durationSec, max);

/** A window read back from storage or a shared video; undefined when it isn't one. */
export function cleanClip(raw: unknown): ClipWindow | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const start = o.start;
  const end = o.end;
  if (typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  if (start < 0 || end - start < 1 || end - start > CLIP_MAX + 1 || end > 3600) return undefined;
  return { start, end };
}

/** Where a looping player should be: back to the start once it reaches the end (or strays before the start). */
export function loopPosition(currentTime: number, w: ClipWindow | undefined): number | undefined {
  if (!w) return undefined;
  if (currentTime >= w.end - 0.05 || currentTime < w.start - 0.5) return w.start;
  return undefined;
}

/** "0:45", "1:05:09". */
export function clockOf(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
