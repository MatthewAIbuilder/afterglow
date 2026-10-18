import { describe, expect, it } from '@jest/globals';
import type { SoundTag } from '../../../data/models';
import { festivalsWith, mainSound } from '../guide';

const a = (sound: Partial<Record<SoundTag, number>>) => ({ sound });

describe('a sound’s own page', () => {
  it('the sound an artist is mostly known for', () => {
    expect(mainSound(a({ dubstep: 0.9, trap: 0.3 }))).toBe('dubstep');
    expect(mainSound(a({}))).toBeUndefined();
    expect(mainSound({})).toBeUndefined();
  });

  it('the festivals with the most of a sound, at least three acts, most first', () => {
    const artists: Record<string, ReturnType<typeof a>> = {
      d1: a({ dubstep: 1 }), d2: a({ dubstep: 1 }), d3: a({ dubstep: 1 }), d4: a({ dubstep: 1 }),
      h1: a({ house: 1 }), h2: a({ house: 1 }),
    };
    const festivals = [
      { id: 'few', lineup: ['d1', 'd2', 'h1', 'h2'] },
      { id: 'many', lineup: ['d1', 'd2', 'd3', 'd4', 'h1'] },
      { id: 'some', lineup: ['d1', 'd2', 'd3'] },
    ];
    expect(festivalsWith('dubstep', festivals, (id) => artists[id]).map((x) => [x.festival.id, x.count])).toEqual([['many', 4], ['some', 3]]);
    expect(festivalsWith('house', festivals, (id) => artists[id])).toEqual([]);
    expect(festivalsWith('dubstep', festivals, (id) => artists[id], 1)).toHaveLength(1);
  });
});
