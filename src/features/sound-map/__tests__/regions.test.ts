import { describe, expect, it } from '@jest/globals';
import type { Artist, SoundTag } from '../../../data/models';
import { computeLayout, regionAt } from '../layout';

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

  it('finds the sound name under a tap', () => {
    const regions = [
      { tag: 'dubstep' as const, x: 100, y: 0 },
      { tag: 'house' as const, x: -100, y: 40 },
    ];
    expect(regionAt(regions, 130, 6)).toBe('dubstep');
    expect(regionAt(regions, -100, 40)).toBe('house');
    expect(regionAt(regions, 0, 0)).toBeUndefined();
    expect(regionAt(regions, 100, 30)).toBeUndefined();
  });
});
