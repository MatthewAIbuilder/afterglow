import { describe, expect, it } from '@jest/globals';
import type { Artist } from '../../../data/models';
import { mostSimilar, similarityWith, soundSimilarity } from '../similarity';

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

describe('similarity from a source', () => {
  it('knows a pair both ways round, the last word wins, and falls back to sound tags', () => {
    const [twin, close, , far] = all.slice(1);
    const sim = similarityWith([
      { artistId: 'me', otherId: 'far', score: 0.2 },
      { artistId: 'far', otherId: 'me', score: 0.6 },
      { artistId: 'me', otherId: 'me', score: 0.1 },
      { artistId: 'twin', otherId: 'close', score: 1.4 },
    ]);
    expect(sim(me, far)).toBe(0.6);
    expect(sim(far, me)).toBe(0.6);
    expect(sim(twin, close)).toBe(1);
    expect(sim(close, twin)).toBe(1);
    expect(sim(me, me)).toBe(soundSimilarity(me, me));
    expect(sim(me, close)).toBe(soundSimilarity(me, close));
  });

  it('measures sound tags alike whichever artist comes first', () => {
    for (const x of all) for (const y of all) expect(soundSimilarity(x, y)).toBeCloseTo(soundSimilarity(y, x), 12);
    expect(soundSimilarity(me, all[3])).toBeCloseTo(0.5 / Math.sqrt(0.89), 12);
    expect(soundSimilarity(me, all[5])).toBe(0);
  });
});
