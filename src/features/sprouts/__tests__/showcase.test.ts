import { describe, expect, it } from '@jest/globals';
import { cleanPublicGarden, publicGarden, showcaseOf } from '../publicGarden';
import { cleanShowcase, liveShowcase, toggleShowcase } from '../showcase';

describe('showcase', () => {
  it('pins up to three, in order, and unpins', () => {
    expect(toggleShowcase([], 'a')).toEqual({ list: ['a'] });
    expect(toggleShowcase(['a', 'b'], 'c')).toEqual({ list: ['a', 'b', 'c'] });
    expect(toggleShowcase(['a', 'b', 'c'], 'd')).toEqual({ list: ['a', 'b', 'c'], full: true });
    expect(toggleShowcase(['a', 'b', 'c'], 'b')).toEqual({ list: ['a', 'c'] });
  });

  it('reads a saved one back safely, and keeps only cards you still have', () => {
    expect(cleanShowcase(['a', 'a', 'B!', 4, 'b', 'c', 'd'])).toEqual(['a', 'b', 'c']);
    expect(cleanShowcase('a')).toEqual([]);
    expect(liveShowcase(['a', 'b', 'c'], new Set(['c', 'a']))).toEqual(['a', 'c']);
  });

  it('goes out with the garden, marked in order, kept however full the garden is', () => {
    const garden = Array.from({ length: 130 }, (_, i) => ({ id: `g${i}`, shown: 'plur', stage: 3 })) as never[];
    const artists = [
      { artistId: 'x', tier: 1, videos: 2 },
      { artistId: 'y', tier: 3, videos: 9, shiny: true },
    ] as never[];
    const list = publicGarden(garden, artists, (id) => id.toUpperCase(), ['y', 'x']);
    expect(list).toHaveLength(120);
    expect(showcaseOf(list).map((r) => [r.artistId, r.pin])).toEqual([
      ['y', 1],
      ['x', 2],
    ]);
    expect(showcaseOf(cleanPublicGarden(JSON.parse(JSON.stringify(list))))).toHaveLength(2);
    expect(cleanPublicGarden([{ k: 'a', artistId: 'x', name: 'X', tier: 1, pin: 7 }])[0]).not.toHaveProperty('pin');
  });
});
