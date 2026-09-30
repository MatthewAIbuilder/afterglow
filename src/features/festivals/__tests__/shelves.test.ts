import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { byMonth, bySoonest, festivalShelf, festivalsAround, isMany, pickerList, SHOW_ALL_UP_TO } from '../shelves';

const fest = (id: string, lineup: string[], startDate?: string, endDate?: string, name = id): Festival => ({
  id,
  name,
  dates: '',
  location: '',
  lineup,
  days: [],
  stages: [],
  ...(startDate ? { startDate, endDate: endDate ?? startDate } : {}),
});
const today = new Date(2026, 9, 1); // Oct 1 2026, local
const loves = (id: string) => id.startsWith('love');

describe('festival shelves', () => {
  const past = fest('past', ['love-a'], '2026-09-01');
  const soon = fest('soon', ['x'], '2026-10-10');
  const later = fest('later', ['love-a', 'love-b'], '2027-03-01');
  const mid = fest('mid', ['love-c', 'y'], '2026-11-01');
  const undated = fest('undated', ['z']);

  it('knows when a list is long', () => {
    expect(isMany(Array.from({ length: SHOW_ALL_UP_TO }, (_, i) => fest(`f${i}`, [])))).toBe(false);
    expect(isMany(Array.from({ length: SHOW_ALL_UP_TO + 1 }, (_, i) => fest(`f${i}`, [])))).toBe(true);
  });

  it('orders by date: soonest, then undated, then finished', () => {
    expect(bySoonest([past, undated, later, soon], today).map((f) => f.id)).toEqual(['soon', 'later', 'undated', 'past']);
  });

  it('puts festivals with the most acts you would love first, leaving out yours and finished ones', () => {
    const shelf = festivalShelf([past, soon, later, mid, undated], ['mid'], loves, today);
    expect(shelf).toEqual({ title: 'For you', festivals: [later] });
    expect(festivalShelf([past, soon, later, mid], [], loves, today).festivals.map((f) => f.id)).toEqual(['later', 'mid']);
  });

  it('falls back to the soonest when none has anyone you would love', () => {
    const shelf = festivalShelf([past, undated, later, soon, mid], [], () => false, today, 2);
    expect(shelf).toEqual({ title: 'Coming up', festivals: [soon, mid] });
  });

  it('a picker shows search results, or your picks and then the shelf', () => {
    const all = [soon, later, fest('edc', [], '2026-11-06', '2026-11-08', 'EDC Orlando')];
    expect(pickerList(all, [], 'edc', [soon]).map((f) => f.id)).toEqual(['edc']);
    expect(pickerList(all, ['edc', 'soon'], '', [soon]).map((f) => f.id)).toEqual(['edc', 'soon']);
  });

  it('offers festivals around the day a video was filmed', () => {
    const all = [soon, later, mid, past, undated];
    const around = festivalsAround(all, { first: [later], when: new Date(2026, 9, 12) });
    expect(around.map((f) => f.id)).toEqual(['later', 'soon', 'mid']);
    expect(festivalsAround(all, { first: [], when: new Date(2026, 9, 12), days: 5 }).map((f) => f.id)).toEqual(['soon']);
    expect(festivalsAround(all, { first: [mid] })).toEqual([mid]);
  });

  it('groups festivals by month, then undated, then finished', () => {
    const groups = byMonth(bySoonest([past, soon, later, mid, undated, fest('soon2', [], '2026-10-20')], today), today);
    expect(groups.map((g) => [g.label, g.festivals.map((f) => f.id)])).toEqual([
      ['October', ['soon', 'soon2']],
      ['November', ['mid']],
      ['March 2027', ['later']],
      ['Date to come', ['undated']],
      ['Finished', ['past']],
    ]);
  });
});
