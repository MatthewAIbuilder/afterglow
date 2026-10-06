import { describe, expect, it } from '@jest/globals';
import { fitFor, MAX_CROP } from '../videoFit';

const iphone = { width: 390, height: 844 };

describe('how a crowd video fills the screen', () => {
  it('fills an upright phone when that crops very little', () => {
    expect(fitFor({ width: 1080, height: 2340 }, iphone)).toBe('cover');
    expect(fitFor({ width: 1080, height: 2100 }, iphone)).toBe('cover');
  });

  it('shows the whole picture when filling would cut a lot off, or the shape is unknown', () => {
    // A 9:16 video on a tall iPhone would lose about 18% of its width.
    expect(fitFor({ width: 1080, height: 1920 }, iphone)).toBe('contain');
    expect(fitFor({ width: 1920, height: 1080 }, iphone)).toBe('contain');
    expect(fitFor(undefined, iphone)).toBe('contain');
    expect(fitFor({ width: 0, height: 0 }, iphone)).toBe('contain');
    expect(MAX_CROP).toBeLessThan(0.18);
  });

  it('fits a landscape video on a wide screen', () => {
    expect(fitFor({ width: 1920, height: 1080 }, { width: 1280, height: 720 })).toBe('cover');
    expect(fitFor({ width: 1080, height: 1920 }, { width: 1280, height: 720 })).toBe('contain');
  });
});
