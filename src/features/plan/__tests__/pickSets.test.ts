import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival } from '../../../data/models';
import { pickHours } from '../pickSets';

const artist = (id: string): Artist => ({ id, name: id.toUpperCase(), sound: {} });
const set = (artistId: string, start: string, end: string, stageId = 'main') => ({ artistId, day: 'Friday', stageId, start, end });
const fest = (sets: ReturnType<typeof set>[]): Festival =>
  ({ id: 'f', name: 'F', dates: '', location: '', lineup: sets.map((s) => s.artistId), days: ['Friday'], stages: [{ id: 'main', name: 'Main' }, { id: 'tent', name: 'Tent' }], sets }) as unknown as Festival;

describe('Pick sets', () => {
  const f = fest([set('late', '23:30', '01:00'), set('a', '21:00', '22:00'), set('b', '21:15', '22:15', 'tent'), set('c', '22:00', '23:00'), set('out', '21:00', '22:00', 'tent')]);
  const opts = { artist: artist, taste: { a: 0.4, b: 0.9 }, informed: { a: true, b: true }, pinned: new Set(['a', 'b']), out: new Set(['out']) };

  it('lists every set of the day in time order, grouped by the hour it starts, leaving out acts you took out', () => {
    const hours = pickHours(f, 'Friday', opts);
    expect(hours.map((h) => [h.hour, h.rows.map((r) => r.artist.id)])).toEqual([
      [21, ['a', 'b']],
      [22, ['c']],
      [23, ['late']],
    ]);
  });

  it('says when two starred acts clash', () => {
    const rows = pickHours(f, 'Friday', opts).flatMap((h) => h.rows);
    expect(rows.find((r) => r.artist.id === 'a')?.clashesWith.map((x) => x.id)).toEqual(['b']);
    expect(rows.find((r) => r.artist.id === 'c')?.clashesWith).toEqual([]);
  });
});
