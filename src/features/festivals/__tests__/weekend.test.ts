import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { forWeekend, playsWeekend, runLabel, validWeekend } from '../weekend';
import { countdown } from '../when';

const acl: Festival = {
  id: 'acl',
  name: 'ACL',
  dates: 'Oct 2 to 4 and Oct 9 to 11',
  location: '',
  lineup: ['both', 'one', 'two'],
  days: ['Friday'],
  stages: [],
  startDate: '2026-10-02',
  endDate: '2026-10-11',
  weekends: [
    { start: '2026-10-02', end: '2026-10-04' },
    { start: '2026-10-09', end: '2026-10-11' },
  ],
  artistWeekends: { one: 1, two: 2 },
  notes: { one: 'Weekend 1 only', two: 'Weekend 2 only' },
  artistDays: { both: ['Friday'], one: ['Friday'], two: ['Friday'] },
};

describe('one weekend of a two-weekend festival', () => {
  it('knows who plays which weekend', () => {
    expect(playsWeekend(acl, 'both', 2)).toBe(true);
    expect(playsWeekend(acl, 'one', 2)).toBe(false);
    expect(playsWeekend(acl, 'one', undefined)).toBe(true);
  });

  it('only accepts a weekend the festival has', () => {
    expect(validWeekend(acl, 2)).toBe(2);
    expect(validWeekend(acl, 3)).toBeUndefined();
    expect(validWeekend({ ...acl, weekends: undefined }, 1)).toBeUndefined();
  });

  it('narrows the lineup and the dates to your weekend', () => {
    const w2 = forWeekend(acl, 2);
    expect(w2.lineup).toEqual(['both', 'two']);
    expect(w2).toMatchObject({ startDate: '2026-10-09', endDate: '2026-10-11' });
    expect(w2.weekends).toBeUndefined();
    expect(w2.notes).toEqual({ two: 'Weekend 2 only' });
    expect(Object.keys(w2.artistDays ?? {})).toEqual(['both', 'two']);
    // Going to weekend 2, the countdown is to weekend 2.
    expect(countdown(w2, new Date(2026, 8, 29, 12))).toBe('In 10 days');
    expect(forWeekend(acl, undefined)).toBe(acl);
  });

  it('names a weekend by its dates', () => {
    expect(runLabel({ start: '2026-10-09', end: '2026-10-11' })).toBe('Oct 9 to 11');
    expect(runLabel({ start: '2026-10-30', end: '2026-11-01' })).toBe('Oct 30 to Nov 1');
    expect(runLabel({ start: '2026-12-31', end: '2026-12-31' })).toBe('Dec 31');
  });
});
