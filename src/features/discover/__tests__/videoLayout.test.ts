import { describe, expect, it } from '@jest/globals';
import { MIN_PLAYER, overlaps, tallLayout } from '../videoLayout';

// Roughly an iPhone 15 and an iPhone SE, with the feed header and tab bar reserved.
const phone = { width: 393, height: 852, top: 159, bottom: 122 };
const small = { width: 320, height: 568, top: 120, bottom: 100 };

describe('tallLayout', () => {
  it('gives vertical footage a 9:16 player with the rail and info clear of it', () => {
    const l = tallLayout(phone)!;
    expect(l).toBeDefined();
    expect(Math.abs(l.player.w / l.player.h - 9 / 16)).toBeLessThan(0.01);
    expect(overlaps(l.player, l.rail)).toBe(false);
    expect(overlaps(l.player, l.info)).toBe(false);
  });

  it('stays on screen and inside the reserved space', () => {
    const l = tallLayout(phone)!;
    for (const r of [l.player, l.rail, l.info]) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(phone.width);
      expect(r.y).toBeGreaterThanOrEqual(phone.top);
      expect(r.y + r.h).toBeLessThanOrEqual(phone.height - phone.bottom);
    }
  });

  it('respects the embedded player minimum', () => {
    const l = tallLayout(phone)!;
    expect(l.player.w).toBeGreaterThanOrEqual(MIN_PLAYER);
    expect(l.player.h).toBeGreaterThanOrEqual(MIN_PLAYER);
  });

  it('falls back (to the stacked card) on a screen too small for it', () => {
    expect(tallLayout(small)).toBeUndefined();
  });
});
