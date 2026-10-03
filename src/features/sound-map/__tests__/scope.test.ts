import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { basisLine, leanLine, mapLenses } from '../scope';

const fest = (id: string, startDate?: string, endDate = startDate): Festival =>
  ({ id, name: id.toUpperCase(), dates: '', location: '', lineup: [], days: [], stages: [], startDate, endDate }) as Festival;
const today = new Date(2026, 9, 3);
const none = { likes: 0, saves: 0, skips: 0, watched: 0, rated: 0, libraries: [] as string[] };

describe("My Sound's choices", () => {
  it('offers all artists, then the festivals you go to soonest first, never ones that are over', () => {
    const festivals = [fest('late', '2026-12-30'), fest('soon', '2026-11-01'), fest('over', '2026-01-01'), fest('other', '2026-10-20')];
    expect(mapLenses(festivals, ['late', 'soon', 'over'], undefined, today).map((l) => l.label)).toEqual(['All artists', 'SOON', 'LATE']);
  });
  it('keeps the festival being shown, and at most three of yours', () => {
    const festivals = ['a', 'b', 'c', 'd', 'e'].map((id, i) => fest(id, `2026-11-0${i + 1}`));
    expect(mapLenses(festivals, ['a', 'b', 'c', 'd'], 'e', today).map((l) => l.id)).toEqual([undefined, 'a', 'b', 'c', 'e']);
    expect(mapLenses(festivals, ['a'], 'a', today).map((l) => l.id)).toEqual([undefined, 'a']);
  });
  it('says what your map rests on in plain words', () => {
    expect(basisLine(none)).toBeUndefined();
    expect(basisLine({ ...none, rated: 1 })).toBe('From 1 rated artist');
    expect(basisLine({ ...none, rated: 4, likes: 2, libraries: ['Spotify'] })).toBe('From your Spotify library, 4 rated artists and 2 likes');
  });
  it('leads with your lean, or a first guess', () => {
    expect(leanLine(['dubstep', 'melodic-bass'], true)).toBe('Leaning dubstep and melodic bass');
    expect(leanLine(['dubstep'], false)).toBe('A first guess at your sound');
  });
});
