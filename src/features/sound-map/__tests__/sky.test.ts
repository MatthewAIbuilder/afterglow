import { describe, expect, it } from '@jest/globals';
import type { Artist } from '../../../data/models';
import { soundSimilarity } from '../../taste/similarity';
import { mixColor, NO_SOUND_COLOR, SOUND_COLOR, withAlpha } from '../colors';
import { computeLayout } from '../layout';
import { chosenLinks, constellation, heartColors, nebulae, starfield } from '../sky';

const art = (id: string, sound: Artist['sound']): Artist => ({ id, name: id.toUpperCase(), sound });
const artists = [
  art('a', { dubstep: 1 }),
  art('b', { dubstep: 0.9, riddim: 0.1 }),
  art('c', { riddim: 1 }),
  art('d', { house: 1 }),
  art('e', { house: 0.8, pop: 0.2 }),
  art('f', {}),
];
const taste = { a: 0.95, b: 0.8, c: 0.7, d: 0.6, e: 0.5, f: 0.4 };
const layout = computeLayout(artists, taste);

describe('sound colours', () => {
  it('gives each sound its own colour and blends a mix, the main sound leading', () => {
    expect(mixColor({ dubstep: 1 })).toBe(SOUND_COLOR.dubstep);
    expect(mixColor({})).toBe(NO_SOUND_COLOR);
    const blend = mixColor({ dubstep: 0.8, house: 0.2 });
    // Closer to dubstep's blue than to house's amber.
    const blue = parseInt(blend.slice(5, 7), 16);
    expect(blue).toBeGreaterThan(200);
    expect(withAlpha('#FF0080', 0.5)).toBe('rgba(255,0,128,0.5)');
  });
});

describe('the sky around the map', () => {
  it('draws a nebula per sound behind its artists, strongest first', () => {
    const clouds = nebulae(layout);
    expect(clouds.map((n) => n.tag)).toEqual(['dubstep', 'house', 'riddim']);
    expect(clouds[0].color).toBe(SOUND_COLOR.dubstep);
    for (const n of clouds) expect(n.r).toBeGreaterThanOrEqual(110);
    expect(nebulae(layout, 1)).toHaveLength(1);
    expect(heartColors(clouds)).toEqual([SOUND_COLOR.dubstep, SOUND_COLOR.house, SOUND_COLOR.riddim]);
    expect(heartColors([])).toEqual([SOUND_COLOR['melodic-bass']]);
  });

  it('joins artists who sound alike, each pair once, never the unrelated', () => {
    const links = constellation(layout.bubbles, soundSimilarity, { reach: 10000 });
    const pairs = links.map((l) => [l.a, l.b].sort().join('-')).sort();
    expect(pairs).toEqual(['a-b', 'd-e']);
    expect(new Set(pairs).size).toBe(pairs.length);
    // Too far apart: no line across the map.
    expect(constellation(layout.bubbles, soundSimilarity, { reach: 1 })).toEqual([]);
  });

  it('joins a chosen artist to the ones most like them', () => {
    const links = chosenLinks(layout.bubbles, 'b', soundSimilarity);
    expect(links[0].b).toBe('a');
    expect(links.every((l) => l.a === 'b')).toBe(true);
    expect(chosenLinks(layout.bubbles, 'nobody', soundSimilarity)).toEqual([]);
  });

  it('scatters the same stars every time, in three groups', () => {
    const one = starfield(800, 1600, 30);
    expect(one).toEqual(starfield(800, 1600, 30));
    expect(new Set(one.map((s) => s.group))).toEqual(new Set([0, 1, 2]));
    for (const s of one) {
      expect(Math.abs(s.x)).toBeLessThanOrEqual(400);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(800);
    }
  });
});
