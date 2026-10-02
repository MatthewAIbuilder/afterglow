import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { isOn, tonightClips, tonightFestival, tonightKey, tonightOrder, tonightTitle } from '../tonight';

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

  it('counts either weekend of a two-weekend festival, and not the days between', () => {
    const acl = fest('acl', {
      startDate: '2026-10-02',
      endDate: '2026-10-11',
      days: ['Friday', 'Saturday', 'Sunday'],
      weekends: [
        { start: '2026-10-02', end: '2026-10-04' },
        { start: '2026-10-09', end: '2026-10-11' },
      ],
    });
    expect(isOn(acl, new Date(2026, 9, 3, 21))).toBe(true);
    expect(isOn(acl, new Date(2026, 9, 5, 9))).toBe(true); // the morning after weekend 1
    expect(isOn(acl, new Date(2026, 9, 7, 21))).toBe(false); // midweek
    expect(isOn(acl, new Date(2026, 9, 10, 21))).toBe(true); // weekend 2
    expect(isOn(acl, new Date(2026, 9, 12, 9))).toBe(true);
    expect(isOn(acl, new Date(2026, 9, 13, 9))).toBe(false);
  });

  it('opens by itself once a night', () => {
    expect(tonightKey('cc4', new Date(2026, 11, 5, 22))).toBe('cc4:2026-12-05');
    expect(tonightKey('cc4', new Date(2026, 11, 6, 2))).toBe('cc4:2026-12-05');
    expect(tonightKey('cc4', new Date(2026, 11, 6, 14))).toBe('cc4:2026-12-06');
    expect(tonightTitle({ festival: cc4, night: 'Saturday' })).toBe('Saturday at CC4');
    expect(tonightTitle({ festival: cc4 })).toBe('CC4');
  });
});

describe('tonight’s preview', () => {
  const clip = (id: string, artistId: string) => ({ id, artistId, festivalId: 'cc4', title: '', durationSec: 60, bpm: 140 });
  const item = (id: string, artistId: string) => ({ clip: clip(id, artistId) });
  const lineup = fest('cc4', {
    startDate: '2026-12-04',
    endDate: '2026-12-06',
    days: ['Friday', 'Saturday', 'Sunday'],
    lineup: ['a', 'b', 'c', 'd'],
    artistDays: { a: ['Saturday'], b: ['Saturday'], c: ['Friday'], d: ['Saturday'] },
  });

  it('one set per artist playing tonight, in ranked order before set times', () => {
    const items = [item('1', 'b'), item('2', 'c'), item('3', 'b'), item('4', 'a')];
    expect(tonightOrder(items, lineup, 'Saturday').map((i) => i.clip.id)).toEqual(['1', '4']);
    expect(tonightClips(lineup, [clip('x', 'a'), clip('y', 'c'), clip('z', 'zz')], 'Saturday').map((c) => c.id)).toEqual(['x']);
  });

  it('in set-time order once set times are out, after-midnight sets last; what is on screen never moves', () => {
    const timed = {
      ...lineup,
      sets: [
        { artistId: 'a', day: 'Saturday', stageId: 'm', start: '00:30', end: '01:30' },
        { artistId: 'b', day: 'Saturday', stageId: 'm', start: '22:00', end: '23:00' },
        { artistId: 'd', day: 'Saturday', stageId: 'm', start: '20:00', end: '21:00' },
      ],
    };
    const items = [item('1', 'a'), item('2', 'b'), item('3', 'd')];
    expect(tonightOrder(items, timed, 'Saturday').map((i) => i.clip.artistId)).toEqual(['d', 'b', 'a']);
    expect(tonightOrder(items, timed, 'Saturday', 1).map((i) => i.clip.artistId)).toEqual(['a', 'd', 'b']);
  });
});
