import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { cleanGoing, groupFestivals, toggleGoing } from '../going';

const fest = (id: string, startDate?: string, endDate?: string): Festival => ({
  id,
  name: id,
  dates: '',
  location: '',
  lineup: [],
  days: [],
  stages: [],
  ...(startDate ? { startDate } : {}),
  ...(endDate ? { endDate } : {}),
});
const today = new Date(2026, 8, 29, 12);

describe('festivals you are going to', () => {
  it('toggles on and off', () => {
    expect(toggleGoing([], 'a')).toEqual(['a']);
    expect(toggleGoing(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('reads back only well-formed ids', () => {
    expect(cleanGoing(['a', 'a', 3, '', 'b'])).toEqual(['a', 'b']);
    expect(cleanGoing({ a: 1 })).toEqual([]);
  });

  it('puts yours first, soonest first, with finished and undated ones after', () => {
    const all = [
      fest('undated'),
      fest('later', '2027-03-12'),
      fest('done', '2026-06-19', '2026-06-21'),
      fest('soon', '2026-11-06', '2026-11-08'),
      fest('not-going', '2026-10-01'),
    ];
    const { going, others } = groupFestivals(all, ['done', 'undated', 'later', 'soon'], today);
    expect(going.map((f) => f.id)).toEqual(['soon', 'later', 'undated', 'done']);
    expect(others.map((f) => f.id)).toEqual(['not-going']);
  });

  it('counts a festival in progress as soonest', () => {
    const { going } = groupFestivals([fest('later', '2026-10-10'), fest('now', '2026-09-28', '2026-09-30')], ['later', 'now'], today);
    expect(going.map((f) => f.id)).toEqual(['now', 'later']);
  });

  it('leaves everything in catalogue order when you are going to nothing', () => {
    const all = [fest('b'), fest('a')];
    expect(groupFestivals(all, [], today)).toEqual({ going: [], others: all });
  });
});
