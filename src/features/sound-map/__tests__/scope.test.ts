import { describe, expect, it } from '@jest/globals';
import type { Artist } from '../../../data/models';
import { artistsOnMap, mapCandidates } from '../layout';

const a = (id: string): Artist => ({ id, name: id, sound: { house: 1 } });
const artists = [a('one'), a('two'), a('three'), a('four')];

describe('what the map can show', () => {
  it('is everyone, or only a festival lineup', () => {
    expect(mapCandidates(artists)).toBe(artists);
    expect(mapCandidates(artists, ['three', 'one', 'missing']).map((x) => x.id)).toEqual(['one', 'three']);
    expect(mapCandidates(artists, [])).toEqual([]);
  });

  it('still only draws artists the app knows something about, best first', () => {
    const taste = { one: 0.2, two: 0.9, three: 0.7, four: 0.5 };
    const informed = { one: true, two: true, three: true, four: false };
    const lineup = mapCandidates(artists, ['one', 'three', 'four']);
    expect(artistsOnMap(lineup, taste, informed).map((x) => x.id)).toEqual(['three', 'one']);
  });
});
