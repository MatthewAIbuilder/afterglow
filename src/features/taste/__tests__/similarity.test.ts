import { describe, expect, it } from '@jest/globals';
import type { Artist } from '../../../data/models';
import { mostSimilar, soundSimilarity } from '../similarity';

const a = (id: string, sound: Artist['sound']): Artist => ({ id, name: id, sound });
const me = a('me', { dubstep: 1 });
const all = [
  me,
  a('twin', { dubstep: 1 }),
  a('close', { dubstep: 0.8, riddim: 0.4 }),
  a('half', { dubstep: 0.5, house: 0.8 }),
  a('far', { house: 1 }),
  a('unknown', {}),
];
const ids = (list: Artist[]) => list.map((x) => x.id);

describe('most similar artists', () => {
  it('lists the closest first, leaving out the artist and anyone too different', () => {
    expect(ids(mostSimilar(me, all, soundSimilarity))).toEqual(['twin', 'close', 'half']);
    expect(ids(mostSimilar(me, all, soundSimilarity, { max: 1 }))).toEqual(['twin']);
    expect(ids(mostSimilar(me, all, soundSimilarity, { min: 0.9 }))).toEqual(['twin']);
  });

  it('only looks where it is told to', () => {
    const lineup = [all[3], all[4], all[5]];
    expect(ids(mostSimilar(me, lineup, soundSimilarity))).toEqual(['half']);
    expect(mostSimilar(me, [], soundSimilarity)).toEqual([]);
  });
});
