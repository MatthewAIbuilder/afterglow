import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival } from '../../../data/models';
import { festivalRoute, WALK_MINUTES } from '../../plan/route';
import { REMINDER_PREFIX, reminderChanges } from '../reminders';
import { canRemindSets, dayStarts, SET_LEAD_MIN, SET_PREFIX, SET_REMINDERS_MAX, setReminders, soonest } from '../setReminders';

const artist = (id: string, name: string): Artist => ({ id, name, sound: { dubstep: 1 } });
const ARTISTS = [artist('a', 'TAPE B'), artist('b', 'SARA LANDRY'), artist('c', 'ILLENIUM')];
const fest: Festival = {
  id: 'f',
  name: 'Test Fest',
  dates: 'Dec 4 to 5',
  location: 'Somewhere',
  lineup: ['a', 'b', 'c'],
  days: ['Friday', 'Saturday'],
  startDate: '2026-12-04',
  endDate: '2026-12-05',
  stages: [
    { id: 'bass', name: 'Bass Tent' },
    { id: 'main', name: 'Main Stage' },
  ],
  sets: [
    { artistId: 'a', day: 'Friday', stageId: 'bass', start: '22:00', end: '23:00' },
    { artistId: 'c', day: 'Friday', stageId: 'main', start: '23:30', end: '01:00' },
    { artistId: 'b', day: 'Saturday', stageId: 'bass', start: '21:00', end: '22:00' },
  ],
};
const route = festivalRoute({ festival: fest, artists: ARTISTS, taste: { a: 0.9, b: 0.8, c: 0.95 }, informed: { a: true, b: true, c: true }, pinned: new Set(['c']) });
const BEFORE = new Date(2026, 11, 1, 12, 0);

describe('set reminders', () => {
  it('times each festival day from its date, only when the days line up with the dates', () => {
    expect(dayStarts(fest)!.get('Saturday')).toEqual(new Date(2026, 11, 5, 0, 0));
    expect(canRemindSets(fest)).toBe(true);
    expect(canRemindSets({ ...fest, endDate: '2026-12-06' })).toBe(false);
    expect(canRemindSets({ ...fest, sets: [] })).toBe(false);
    expect(canRemindSets({ ...fest, startDate: undefined })).toBe(false);
  });

  it('a nudge before the first set of each night and before each change of stage, with the walk', () => {
    const got = setReminders(fest, route, BEFORE);
    expect(got.map((r) => r.title)).toEqual(['TAPE B at 10:00 PM', '★ ILLENIUM at 11:30 PM', 'SARA LANDRY at 9:00 PM']);
    // First of the night: ten minutes before it starts.
    expect(got[0].at).toEqual(new Date(2026, 11, 4, 21, 50));
    expect(got[0].body).toBe(`Be at Bass Tent in ${SET_LEAD_MIN} min.`);
    // Another stage (after a break): ten minutes before you need to leave, allowing for the walk.
    expect(got[1].at).toEqual(new Date(2026, 11, 4, 23, 30 - WALK_MINUTES - SET_LEAD_MIN));
    expect(got[1].body).toBe(`Head to Main Stage in ${SET_LEAD_MIN} min (a ${WALK_MINUTES} min walk).`);
    expect(got.every((r) => r.id.startsWith(SET_PREFIX) && r.id.startsWith(REMINDER_PREFIX) && r.festivalId === 'f')).toBe(true);
  });

  it('only future ones; none for a festival whose days can’t be timed', () => {
    expect(setReminders(fest, route, new Date(2026, 11, 5, 12, 0)).map((r) => r.title)).toEqual(['SARA LANDRY at 9:00 PM']);
    expect(setReminders({ ...fest, endDate: undefined }, route, BEFORE)).toEqual([]);
  });

  it('when the plan changes, the old reminder goes and the new one comes', () => {
    const before = setReminders(fest, route, BEFORE);
    const moved = festivalRoute({ festival: { ...fest, sets: fest.sets!.map((s) => (s.artistId === 'a' ? { ...s, start: '22:30' } : s)) }, artists: ARTISTS, taste: { a: 0.9, b: 0.8, c: 0.95 }, informed: { a: true, b: true, c: true }, pinned: new Set(['c']) });
    const after = setReminders(fest, moved, BEFORE);
    const { cancel, schedule } = reminderChanges(after, [...before.map((r) => r.id), 'someone-else:1']);
    expect(cancel).toEqual([before[0].id]);
    expect(schedule.map((r) => r.title)).toEqual(['TAPE B at 10:30 PM']);
  });

  it('at most SET_REMINDERS_MAX, the soonest', () => {
    const many = Array.from({ length: SET_REMINDERS_MAX + 5 }, (_, i) => ({ id: `x${i}`, festivalId: 'f', at: new Date(2026, 11, 1, 0, SET_REMINDERS_MAX + 5 - i), title: '', body: '' }));
    const kept = soonest(many);
    expect(kept).toHaveLength(SET_REMINDERS_MAX);
    expect(kept[0].id).toBe(`x${SET_REMINDERS_MAX + 4}`);
  });
});
