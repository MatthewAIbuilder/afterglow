import { describe, expect, it } from '@jest/globals';
import { MIN_PLAYER, overlaps, videoLayout } from '../videoLayout';

// Portrait phones from small to large. top = safe area + 100 header clearance;
// bottom = tab bar (64 + max(safe area, 12) + 8) + 16, as the feed reserves.
const PHONES = [
  { width: 320, height: 568, top: 120, bottom: 100 },
  { width: 375, height: 667, top: 120, bottom: 100 },
  { width: 390, height: 844, top: 147, bottom: 122 },
  { width: 430, height: 932, top: 159, bottom: 122 },
];

describe('videoLayout', () => {
  for (const phone of PHONES) {
    for (const vertical of [true, false]) {
      it(`keeps the player clear and big enough on ${phone.width}x${phone.height} (${vertical ? 'vertical' : 'horizontal'})`, () => {
        const layout = videoLayout({ ...phone, vertical });
        const { player } = layout;
        expect(player.w).toBeGreaterThanOrEqual(MIN_PLAYER);
        expect(player.h).toBeGreaterThanOrEqual(MIN_PLAYER);
        expect(player.y).toBeGreaterThanOrEqual(phone.top);
        expect(player.x + player.w).toBeLessThanOrEqual(phone.width);
        if (layout.mode !== 'stacked') {
          expect(overlaps(player, layout.rail)).toBe(false);
          expect(overlaps(player, layout.info)).toBe(false);
          expect(layout.info.y + layout.info.h).toBeLessThanOrEqual(phone.height - phone.bottom);
        }
      });
    }
  }

  it('gives vertical footage a tall player with the rail beside it on a regular phone', () => {
    const layout = videoLayout({ ...PHONES[2], vertical: true });
    expect(layout.mode).toBe('beside');
    expect(layout.player.h).toBeGreaterThan(layout.player.w * 1.7);
  });

  it('centres horizontal footage above the rail on a regular phone', () => {
    const layout = videoLayout({ ...PHONES[2], vertical: false });
    expect(layout.mode).toBe('centered');
  });

  it('falls back to the stacked layout when there is no room above the rail', () => {
    expect(videoLayout({ ...PHONES[1], vertical: false }).mode).toBe('stacked');
  });
});
