import { describe, expect, it } from '@jest/globals';
import { cleanPublicGarden, gardenCounts, gardenKey, publicGarden } from '../publicGarden';
import type { GardenView } from '../sprouts';

const view = (over: Partial<GardenView>): GardenView => ({ id: 'x', kind: 'seedling', from: 'u', at: 1, shown: 'seedling', stage: 1, ...over }) as GardenView;

describe('a garden as others see it', () => {
  it('lists who lives there and nothing private: sprouts, then collectibles earned, then ones given', () => {
    const garden = [
      view({ id: 'abc', note: 'secret', shown: 'plur', stage: 3, handle: 'maya' }),
      view({ id: 'def', artist: { id: 'levity', name: 'LEVITY' } }),
    ];
    const list = publicGarden(garden, [{ artistId: 'subtronics', videos: 3, tier: 1, firstAt: 1, lastAt: 2 }], (id) => (id === 'subtronics' ? 'SUBTRONICS' : undefined));
    expect(list).toEqual([
      { k: 's', kind: 'plur', stage: 3 },
      { k: 'a', artistId: 'subtronics', name: 'SUBTRONICS', tier: 1 },
      { k: 'a', artistId: 'levity', name: 'LEVITY', tier: 0 },
    ]);
    expect(JSON.stringify(list)).not.toMatch(/secret|abc|maya/);
    expect(gardenCounts(list)).toEqual({ sprouts: 1, collectibles: 2 });
    expect(gardenKey(list)).toBe('splur3|asubtronics1|alevity0');
  });

  it('reads a published garden back, leaving out anything odd', () => {
    expect(cleanPublicGarden([{ k: 's', kind: 'bass', stage: 2 }, { k: 's', kind: 'gold', stage: 2 }, { k: 'a', artistId: 'x y', name: 'X', tier: 0 }, { k: 'a', artistId: 'rezz', name: ' REZZ ', tier: 2 }, null])).toEqual([
      { k: 's', kind: 'bass', stage: 2 },
      { k: 'a', artistId: 'rezz', name: 'REZZ', tier: 2 },
    ]);
    expect(cleanPublicGarden('nope')).toEqual([]);
  });
});
