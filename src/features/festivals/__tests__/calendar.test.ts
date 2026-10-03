import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { calendarMonths, festivalsOn, monthFestivals, monthGrid, monthLine, monthTitle } from '../calendar';

const fest = (id: string, extra: Partial<Festival>) => ({ id, name: id, dates: '', location: '', lineup: [], days: [], stages: [], ...extra }) as unknown as Festival;

describe('the festival calendar', () => {
  it('lays a month out Monday first, with blanks around it', () => {
    const weeks = monthGrid({ year: 2026, month: 9 }); // October 2026 starts on a Thursday
    expect(weeks[0]).toEqual([undefined, undefined, undefined, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it('knows what’s on each day, two weekends but not the days between', () => {
    const acl = fest('acl', { startDate: '2026-10-02', endDate: '2026-10-11', weekends: [{ start: '2026-10-02', end: '2026-10-04' }, { start: '2026-10-09', end: '2026-10-11' }] });
    const edc = fest('edc', { startDate: '2026-11-06', endDate: '2026-11-08' });
    expect(festivalsOn([acl, edc], '2026-10-03').map((f) => f.id)).toEqual(['acl']);
    expect(festivalsOn([acl, edc], '2026-10-06')).toEqual([]);
    expect([...monthFestivals([acl, edc], { year: 2026, month: 9 }).keys()]).toEqual(['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-09', '2026-10-10', '2026-10-11']);
    const months = calendarMonths([acl, edc], new Date(2026, 9, 3));
    expect(months).toEqual([
      { year: 2026, month: 9 },
      { year: 2026, month: 10 },
    ]);
    expect(monthTitle({ year: 2027, month: 0 }, new Date(2026, 9, 3))).toBe('January 2027');
    expect(monthLine(2, { year: 2026, month: 9 })).toBe('2 festivals in October');
  });
});
