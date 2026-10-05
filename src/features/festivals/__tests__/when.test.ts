import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { whenRank } from '../shelves';
import { countdown, daysUntil, isLive, setLine } from '../when';

const edc: Festival = {
  id: 'edc',
  name: 'EDC',
  dates: 'Nov 6 to 8',
  location: '',
  lineup: [],
  days: [],
  stages: [],
  startDate: '2026-11-06',
  endDate: '2026-11-08',
};
const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe('festival countdown', () => {
  it('counts calendar days to the first day', () => {
    expect(daysUntil(edc, day(2026, 9, 29))).toBe(38);
    expect(countdown(edc, day(2026, 9, 29))).toBe('In 38 days');
    // Late at night or early morning, it's still the same calendar day.
    expect(countdown(edc, day(2026, 9, 29, 23))).toBe('In 38 days');
    expect(countdown(edc, day(2026, 9, 29, 0))).toBe('In 38 days');
  });

  it('switches to months far out, and to tomorrow, now and over close to the day', () => {
    expect(countdown(edc, day(2026, 6, 1))).toBe('In 5 months');
    expect(countdown(edc, day(2026, 11, 5))).toBe('Tomorrow');
    expect(countdown(edc, day(2026, 11, 6))).toBe('Happening now');
    expect(countdown(edc, day(2026, 11, 8))).toBe('Happening now');
    expect(countdown(edc, day(2026, 11, 9))).toBe('Over');
  });

  it('treats a one-day festival as happening only on that day, and says nothing without dates', () => {
    const oneDay = { ...edc, endDate: undefined };
    expect(countdown(oneDay, day(2026, 11, 6))).toBe('Happening now');
    expect(countdown(oneDay, day(2026, 11, 7))).toBe('Over');
    expect(countdown({ ...edc, startDate: undefined, endDate: undefined }, day(2026, 9, 29))).toBeUndefined();
  });

  it('knows the weekends of a festival run over two', () => {
    const acl: Festival = {
      ...edc,
      startDate: '2026-10-02',
      endDate: '2026-10-11',
      weekends: [
        { start: '2026-10-02', end: '2026-10-04' },
        { start: '2026-10-09', end: '2026-10-11' },
      ],
    };
    expect(countdown(acl, day(2026, 9, 29))).toBe('In 3 days');
    expect(countdown(acl, day(2026, 10, 3))).toBe('Happening now');
    // The week between the weekends isn't "happening now".
    expect(countdown(acl, day(2026, 10, 5))).toBe('Weekend 2 in 4 days');
    expect(countdown(acl, day(2026, 10, 8))).toBe('Weekend 2 tomorrow');
    expect(countdown(acl, day(2026, 10, 10))).toBe('Happening now');
    expect(countdown(acl, day(2026, 10, 12))).toBe('Over');
  });

  it('joins a set time and a note', () => {
    expect(setLine('Friday 9:00 PM, Main Stage', 'Sunset set')).toBe('Friday 9:00 PM, Main Stage · Sunset set');
    expect(setLine(undefined, 'Sunset set')).toBe('Sunset set');
    expect(setLine('Friday 9:00 PM, Main Stage', undefined)).toBe('Friday 9:00 PM, Main Stage');
    expect(setLine(undefined, undefined)).toBeUndefined();
  });
});

describe('the last night, after midnight', () => {
  it('a festival without listed days is on from its first date to the morning after its last', () => {
    expect(isLive(edc, day(2026, 11, 5))).toBe(false);
    expect(isLive(edc, day(2026, 11, 7))).toBe(true);
    expect(isLive(edc, day(2026, 11, 9, 2))).toBe(true);
    expect(isLive(edc, day(2026, 11, 10))).toBe(false);
  });

  it('closing sets after midnight still count as happening now, not over', () => {
    expect(countdown(edc, day(2026, 11, 9, 1))).toBe('Happening now');
    expect(whenRank(edc, day(2026, 11, 9, 1))).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(countdown(edc, day(2026, 11, 9, 9))).toBe('Over');
    expect(whenRank(edc, day(2026, 11, 9, 9))).toBe(Number.MAX_SAFE_INTEGER);
  });
});
