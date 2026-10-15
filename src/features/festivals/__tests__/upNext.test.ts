import { describe, expect, it } from '@jest/globals';
import type { Artist } from '../../../data/models';
import { countdownLights, topForYou } from '../upNext';

const artist = (id: string) => ({ id, name: id.toUpperCase() }) as Artist;

describe('countdown lights', () => {
  it('a light a night for the last fortnight: the nights behind you lit', () => {
    const lights = countdownLights(3)!;
    expect(lights).toHaveLength(14);
    expect(lights.filter(Boolean)).toHaveLength(11);
    expect(lights.slice(-3)).toEqual([false, false, false]);
  });

  it('none further out, or once it’s on', () => {
    expect(countdownLights(15)).toBeUndefined();
    expect(countdownLights(0)).toBeUndefined();
    expect(countdownLights(-1)).toBeUndefined();
    expect(countdownLights(14)!.every((lit) => !lit)).toBe(true);
  });
});

describe('your top artists on a lineup', () => {
  it('the best matches first, as whole percents, leaving out ones with no match', () => {
    const ranked = ['a', 'b', 'c', 'd'].map(artist);
    expect(topForYou(ranked, { a: 0.994, b: 0.5, c: 0.2, d: 0.1 }).map((x) => [x.artist.id, x.match])).toEqual([
      ['a', 99],
      ['b', 50],
      ['c', 20],
    ]);
    expect(topForYou(ranked, { a: 0.4 })).toHaveLength(1);
    expect(topForYou(ranked, {})).toEqual([]);
  });
});
