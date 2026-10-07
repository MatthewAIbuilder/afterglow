import { describe, expect, it } from '@jest/globals';
import { stackSame } from '../stack';

describe('stacking the same sprout', () => {
  it('shows one of each look with how many, in first-seen order', () => {
    const list = [
      { id: 'a', shown: 'seedling', stage: 2 },
      { id: 'b', shown: 'plur', stage: 3 },
      { id: 'c', shown: 'seedling', stage: 2 },
      { id: 'd', shown: 'seedling', stage: 1 },
      { id: 'e', shown: 'seedling', stage: 2 },
      { id: 'f', shown: 'bass', stage: 3, artist: { id: 'subtronics' } },
      { id: 'g', shown: 'bass', stage: 3, artist: { id: 'excision' } },
    ];
    expect(stackSame(list).map((s) => [s.item.id, s.count])).toEqual([
      ['a', 3],
      ['b', 1],
      ['d', 1],
      ['f', 1],
      ['g', 1],
    ]);
  });
});
