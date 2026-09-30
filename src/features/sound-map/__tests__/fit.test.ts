import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../../../data/bundled';
import { MOCK_TASTE } from '../../../data/mock';
import { computeTaste } from '../../taste/engine';
import { artistsOnMap, computeLayout, fitScale, FULL_LABELS } from '../layout';

const { catalog } = BUILT_IN;

describe('framing the map', () => {
  it('frames the strongest matches at a readable size, even on a big map', () => {
    const { taste, informed } = computeTaste(MOCK_TASTE, catalog.artists, catalog.clips, {}, undefined, {
      subtronics: 'love',
      illenium: 'love',
      excision: 'like',
      levity: 'love',
    });
    const layout = computeLayout(artistsOnMap(catalog.artists, taste, informed), taste);
    expect(layout.bubbles.length).toBe(40);
    const s = fitScale(layout, 390, 600);
    expect(s).toBeGreaterThanOrEqual(0.5);
    expect(s).toBeLessThanOrEqual(1.1);
    // The heart fits the screen: every one of the strongest matches is on it.
    const heart = [...layout.bubbles].sort((a, b) => b.affinity - a.affinity).slice(0, FULL_LABELS);
    const big = fitScale(layout, 1000, 1400, { min: 0 });
    const fits = heart.every((b) => (Math.abs(b.x) + b.r) * big <= 500 && (Math.abs(b.y) + b.r) * big <= 700);
    expect(fits).toBe(true);
    // Everyone would need a much smaller zoom than the heart does.
    const all = fitScale(layout, 390, 600, { core: 40, min: 0 });
    expect(all).toBeLessThan(fitScale(layout, 390, 600, { min: 0 }));
    expect(fitScale({ bubbles: [], regions: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } }, 390, 600)).toBe(1.1);
  });

  it('a small map fills the screen, and never zooms in past 1.1', () => {
    const one = computeLayout(catalog.artists.slice(0, 1), { [catalog.artists[0].id]: 0.9 });
    expect(fitScale(one, 390, 600)).toBe(1.1);
  });
});
