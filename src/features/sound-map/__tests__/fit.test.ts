import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../../../data/bundled';
import { MOCK_TASTE } from '../../../data/mock';
import { computeTaste } from '../../taste/engine';
import { artistsOnMap, computeLayout, fitScale, frameMap, MAP_MAX, TOP_NAMED } from '../layout';

const { catalog } = BUILT_IN;

function bigMap() {
  const { taste, informed } = computeTaste(MOCK_TASTE, catalog.artists, catalog.clips, {}, undefined, {
    subtronics: 'love',
    illenium: 'love',
    excision: 'like',
    levity: 'love',
  });
  return computeLayout(artistsOnMap(catalog.artists, taste, informed), taste);
}

describe('framing the map', () => {
  it('opens on the whole map, centred on everyone, never below a readable zoom', () => {
    const layout = bigMap();
    expect(layout.bubbles.length).toBe(MAP_MAX);
    const f = frameMap(layout, 390, 600);
    expect(f.scale).toBeGreaterThanOrEqual(0.42);
    expect(f.scale).toBeLessThanOrEqual(1.1);
    // On a big screen everyone fits, centred.
    const big = frameMap(layout, 1600, 1600, { min: 0 });
    const { minX, maxX, minY, maxY } = layout.bounds;
    expect((maxX - minX) * big.scale).toBeLessThanOrEqual(1600);
    expect((maxY - minY) * big.scale).toBeLessThanOrEqual(1600);
    expect(big.x).toBeCloseTo(-((minX + maxX) / 2) * big.scale);
    expect(big.y).toBeCloseTo(-((minY + maxY) / 2) * big.scale);
    expect(fitScale({ bubbles: [], regions: [], leaders: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } }, 390, 600)).toBe(1.1);
  });

  it('stays compact: a full map is at most about two and a half screens across', () => {
    const { bounds } = bigMap();
    expect(bounds.maxX - bounds.minX).toBeLessThan(1000);
    expect(bounds.maxY - bounds.minY).toBeLessThan(1000);
  });

  it('names the strongest artist of each sound and your top few, so a zoomed-out map still reads', () => {
    const layout = bigMap();
    const ranked = [...layout.bubbles].sort((a, b) => b.affinity - a.affinity);
    for (const b of ranked.slice(0, TOP_NAMED)) expect(layout.leaders).toContain(b.artist.id);
    expect(layout.leaders.length).toBeLessThan(layout.bubbles.length / 2);
  });

  it('puts each sound’s name by its own group, clear of every bubble', () => {
    const layout = bigMap();
    expect(layout.regions.length).toBeGreaterThan(1);
    for (const r of layout.regions) for (const b of layout.bubbles) expect(Math.abs(b.x - r.x) >= b.r + 20 || Math.abs(b.y - r.y) >= b.r + 9).toBe(true);
  });

  it('a small map fills the screen, and never zooms in past 1.1', () => {
    const one = computeLayout(catalog.artists.slice(0, 1), { [catalog.artists[0].id]: 0.9 });
    expect(fitScale(one, 390, 600)).toBe(1.1);
  });
});
