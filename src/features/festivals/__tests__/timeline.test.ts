import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { bigCountdown, dateBlock } from '../timeline';

const fest = (extra: Partial<Festival>): Festival => ({ id: 'f', name: 'F', dates: '', location: '', lineup: [], days: ['Friday', 'Saturday', 'Sunday'], stages: [], ...extra }) as Festival;
const day = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 12);

describe('the festivals timeline', () => {
  it('shows dates as a calendar block', () => {
    expect(dateBlock({ startDate: '2026-12-04', endDate: '2026-12-06' })).toEqual({ month: 'DEC', days: '4–6' });
    expect(dateBlock({ startDate: '2026-12-31', endDate: '2027-01-01' })).toEqual({ month: 'DEC', days: '31–1' });
    expect(dateBlock({ startDate: '2026-11-07' })).toEqual({ month: 'NOV', days: '7' });
    expect(dateBlock({ startDate: '2026-10-02', endDate: '2026-10-11', weekends: [{ start: '2026-10-02', end: '2026-10-04' }, { start: '2026-10-09', end: '2026-10-11' }] })).toEqual({ month: 'OCT', days: '2–11' });
    expect(dateBlock({})).toBeUndefined();
  });

  it('counts down in big numbers', () => {
    const f = fest({ startDate: '2026-12-04', endDate: '2026-12-06' });
    expect(bigCountdown(f, day('2026-10-03'))).toEqual({ value: '62', unit: 'days to go' });
    expect(bigCountdown(f, day('2026-12-03'))).toEqual({ value: '1', unit: 'day to go' });
    expect(bigCountdown(f, day('2026-12-05'))).toEqual({ value: 'Now', unit: 'happening', live: true });
    expect(bigCountdown(f, day('2026-12-08'))).toBeUndefined();
    expect(bigCountdown(fest({ startDate: '2027-04-01', endDate: '2027-04-02' }), day('2026-10-03'))).toEqual({ value: '6', unit: 'months to go' });
    expect(bigCountdown(fest({}), day('2026-10-03'))).toBeUndefined();
    const acl = fest({ startDate: '2026-10-02', endDate: '2026-10-11', weekends: [{ start: '2026-10-02', end: '2026-10-04' }, { start: '2026-10-09', end: '2026-10-11' }] });
    expect(bigCountdown(acl, day('2026-10-06'))).toEqual({ value: '3', unit: 'days to weekend 2' });
  });
});
