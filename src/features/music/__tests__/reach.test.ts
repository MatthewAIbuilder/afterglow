import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { isUpcoming, matchedBy, onUpcomingFestivals } from '../reach';

/** "18 artists found on upcoming festivals": which festivals count, and each artist once. */
const fest = (id: string, lineup: string[], dates: Partial<Festival> = {}): Festival =>
  ({ id, name: id, dates: '', location: '', lineup, days: [], stages: [], ...dates }) as Festival;
const TODAY = new Date(2026, 8, 29); // Sep 29 2026, local time

describe('library reach', () => {
  it('a festival is upcoming until its last day is over; undated ones count', () => {
    expect(isUpcoming(fest('a', [], { startDate: '2026-10-02', endDate: '2026-10-04' }), TODAY)).toBe(true);
    expect(isUpcoming(fest('b', [], { startDate: '2026-09-27', endDate: '2026-09-29' }), TODAY)).toBe(true);
    expect(isUpcoming(fest('c', [], { startDate: '2026-05-15', endDate: '2026-05-17' }), TODAY)).toBe(false);
    expect(isUpcoming(fest('d', []), TODAY)).toBe(true);
  });

  it('counts each library artist once, only when they play an upcoming festival', () => {
    const festivals = [
      fest('past', ['old-act', 'both'], { startDate: '2026-05-15', endDate: '2026-05-17' }),
      fest('soon', ['both', 'new-act'], { startDate: '2026-10-02', endDate: '2026-10-04' }),
      fest('later', ['new-act'], { startDate: '2026-12-30', endDate: '2026-12-31' }),
    ];
    expect(onUpcomingFestivals(['old-act', 'both', 'new-act', 'new-act', 'not-on-any'], festivals, TODAY)).toBe(2);
    expect(onUpcomingFestivals([], festivals, TODAY)).toBe(0);
  });

  it('splits the matched artists by service', () => {
    const from = { illenium: ['spotify' as const], subtronics: ['spotify' as const, 'apple-music' as const], levity: ['apple-music' as const] };
    expect(matchedBy(from, 'spotify').sort()).toEqual(['illenium', 'subtronics']);
    expect(matchedBy(from, 'apple-music').sort()).toEqual(['levity', 'subtronics']);
  });
});
