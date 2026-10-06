import { describe, expect, it } from '@jest/globals';
import { CLIP_MAX, clampWindow, cleanClip, clockOf, isWhole, loopPosition, movedTo, needsTrim, suggestWindow, withLength } from '../trim';

describe('trimming a video', () => {
  it('only a video longer than a minute has to be trimmed', () => {
    expect(needsTrim(61)).toBe(false);
    expect(needsTrim(62)).toBe(true);
    expect(needsTrim(undefined)).toBe(false);
  });

  it('keeps the part inside the video and at most a minute long', () => {
    expect(clampWindow({ start: -5, end: 20 }, 95)).toEqual({ start: 0, end: 25 });
    expect(clampWindow({ start: 80, end: 110 }, 95)).toEqual({ start: 65, end: 95 });
    expect(clampWindow({ start: 0, end: 120 }, 300)).toEqual({ start: 0, end: CLIP_MAX });
    expect(clampWindow({ start: 10, end: 10.5 }, 95)).toEqual({ start: 10, end: 13 });
    expect(clampWindow({ start: 0, end: 10 }, 0)).toBeUndefined();
  });

  it('suggests the loudest stretch, or the start when the sound can’t be read', () => {
    // 100 s in 1 s slices, loud from 60 to 70.
    const loud = Array.from({ length: 100 }, (_, i) => (i >= 60 && i < 70 ? 1 : 0.1));
    expect(suggestWindow(100, loud, 10)).toEqual({ start: 60, end: 70 });
    expect(suggestWindow(100, undefined)).toEqual({ start: 0, end: 30 });
    expect(suggestWindow(20, loud)).toEqual({ start: 0, end: 20 });
    expect(suggestWindow(100, Array(100).fill(0))).toEqual({ start: 0, end: 30 });
  });

  it('a new length keeps the middle; moving keeps the length', () => {
    expect(withLength({ start: 40, end: 70 }, 15, 95)).toEqual({ start: 47.5, end: 62.5 });
    expect(withLength({ start: 0, end: 30 }, 45, 95)).toEqual({ start: 0, end: 45 });
    expect(movedTo({ start: 0, end: 30 }, 90, 95)).toEqual({ start: 65, end: 95 });
    expect(isWhole(undefined, 40)).toBe(true);
    expect(isWhole({ start: 0, end: 40 }, 40)).toBe(true);
    expect(isWhole({ start: 1, end: 40 }, 40)).toBe(false);
  });

  it('players loop back to the start at the end', () => {
    const w = { start: 10, end: 40 };
    expect(loopPosition(20, w)).toBeUndefined();
    expect(loopPosition(40, w)).toBe(10);
    expect(loopPosition(2, w)).toBe(10);
    expect(loopPosition(50, undefined)).toBeUndefined();
  });

  it('read back safely, and written as a clock', () => {
    expect(cleanClip({ start: 1, end: 46 })).toEqual({ start: 1, end: 46 });
    expect(cleanClip({ start: 0, end: 90 })).toBeUndefined();
    expect(cleanClip({ start: -1, end: 20 })).toBeUndefined();
    expect(cleanClip({ start: 5 })).toBeUndefined();
    expect(clockOf(65)).toBe('1:05');
    expect(clockOf(3725)).toBe('1:02:05');
  });
});
