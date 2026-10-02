import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { isOn, tonightFestival, tonightKey, tonightTitle } from '../tonight';

const fest = (id: string, more: Partial<Festival>): Festival => ({ id, name: id.toUpperCase(), dates: '', location: '', lineup: [], days: [], stages: [], ...more });
const cc4 = fest('cc4', { startDate: '2026-12-04', endDate: '2026-12-06', days: ['Friday', 'Saturday', 'Sunday'] });
const nye = fest('nye', { startDate: '2026-12-30', endDate: '2026-12-31', days: ['Wednesday', 'Thursday'] });

describe('festival-day mode', () => {
  it('knows when a festival you are going to is on, and which night', () => {
    const sat = new Date(2026, 11, 5, 22, 30);
    expect(tonightFestival([cc4, nye], ['cc4', 'nye'], sat)).toEqual({ festival: cc4, night: 'Saturday' });
    // 1 AM on Sunday morning is still Saturday night.
    expect(tonightFestival([cc4], ['cc4'], new Date(2026, 11, 6, 1))?.night).toBe('Saturday');
    // Not going, or not on: nothing.
    expect(tonightFestival([cc4], [], sat)).toBeUndefined();
    expect(tonightFestival([cc4], ['cc4'], new Date(2026, 11, 2, 22))).toBeUndefined();
    // The morning after the last day still counts; the day after that doesn't.
    expect(isOn(cc4, new Date(2026, 11, 7, 9))).toBe(true);
    expect(isOn(cc4, new Date(2026, 11, 8, 9))).toBe(false);
  });

  it('opens by itself once a night', () => {
    expect(tonightKey('cc4', new Date(2026, 11, 5, 22))).toBe('cc4:2026-12-05');
    expect(tonightKey('cc4', new Date(2026, 11, 6, 2))).toBe('cc4:2026-12-05');
    expect(tonightKey('cc4', new Date(2026, 11, 6, 14))).toBe('cc4:2026-12-06');
    expect(tonightTitle({ festival: cc4, night: 'Saturday' })).toBe('Saturday at CC4');
    expect(tonightTitle({ festival: cc4 })).toBe('CC4');
  });
});
