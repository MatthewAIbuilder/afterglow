import { describe, expect, it } from '@jest/globals';
import type { Artist, SoundTag } from '../../../data/models';
import { computeLayout } from '../layout';

const artist = (id: string, tag: SoundTag): Artist => ({ id, name: id.toUpperCase(), sound: { [tag]: 1 } });

describe('sound names around the map', () => {
  it('never prints two neighbouring sounds on top of each other', () => {
    // Melodic bass and rock sit next to each other on the ring.
    const artists = [
      artist('m1', 'melodic-bass'),
      artist('m2', 'melodic-bass'),
      artist('m3', 'melodic-bass'),
      artist('r1', 'rock'),
      artist('h1', 'house'),
      artist('t1', 'trap'),
    ];
    const taste = Object.fromEntries(artists.map((a, i) => [a.id, 0.9 - i * 0.05]));
    const { regions } = computeLayout(artists, taste);
    for (const [i, r] of regions.entries())
      for (const other of regions.slice(i + 1)) expect(Math.abs(r.x - other.x) >= 72 || Math.abs(r.y - other.y) >= 22).toBe(true);
    // The stronger of the two keeps its name.
    expect(regions.map((r) => r.tag)).toContain('melodic-bass');
  });
});
