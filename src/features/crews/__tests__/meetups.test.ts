import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/types';
import type { CrewMeetup } from '../../social/models';
import { cleanMeetupInput, meetupReminders, suggestMeetups, upcomingMeetups } from '../meetups';
import type { CrewDay } from '../crewRoute';

const now = new Date(2026, 10, 6, 20, 0).getTime();
const meetup = (id: string, at: number, place = 'Main Stage'): CrewMeetup => ({ id, crewId: 'c', place, at: new Date(at).toISOString(), by: 'u1', createdAt: '' });

describe('crew meetups', () => {
  it('checks a meetup before it’s sent', () => {
    expect(cleanMeetupInput({ place: '  Main   Stage ', atMs: now + 61_000 }, now)).toEqual({ ok: true, value: { place: 'Main Stage', atMs: now + 60_000 } });
    expect(cleanMeetupInput({ place: ' ', atMs: now }, now)).toEqual({ ok: false, why: 'place' });
    expect(cleanMeetupInput({ place: 'x', atMs: now - 2 * 3600_000 }, now)).toEqual({ ok: false, why: 'time' });
    expect(cleanMeetupInput({ place: 'x', atMs: now + 40 * 24 * 3600_000 }, now)).toEqual({ ok: false, why: 'time' });
    expect(cleanMeetupInput({ place: 'x', atMs: now, note: ' bring water ' }, now)).toEqual({ ok: true, value: { place: 'x', atMs: now, note: 'bring water' } });
  });

  it('shows what’s coming up, and reminds 15 minutes before and at the time', () => {
    const list = [meetup('b', now + 2 * 3600_000), meetup('a', now + 30 * 60_000), meetup('old', now - 3600_000)];
    expect(upcomingMeetups(list, now).map((m) => m.id)).toEqual(['a', 'b']);
    const r = meetupReminders([{ crewId: 'c', crewName: 'Bass crew', meetup: list[1] }], new Date(now));
    expect(r.map((x) => [x.title, x.body, new Date(x.at).getHours(), new Date(x.at).getMinutes(), x.href])).toEqual([
      ['Meet Bass crew in 15 min', 'Main Stage at 8:30 PM.', 20, 15, '/crew/c'],
      ['Time to meet Bass crew', 'Main Stage, now.', 20, 30, '/crew/c'],
    ]);
    // Only what's still ahead.
    expect(meetupReminders([{ crewId: 'c', crewName: 'Bass crew', meetup: list[1] }], new Date(now + 20 * 60_000)).map((x) => x.title)).toEqual(['Time to meet Bass crew']);
  });

  it('suggests where and when to find each other after the crew splits', () => {
    const festival = { id: 'f', name: 'F', dates: '', location: '', lineup: [], days: ['Friday'], stages: [{ id: 'main', name: 'Main Stage' }, { id: 'tent', name: 'Bass Tent' }], startDate: '2026-11-06', endDate: '2026-11-06' } as Festival;
    const a = (id: string) => ({ id, name: id.toUpperCase(), sound: {} });
    const stop = (id: string, stage: string, from: number, to: number) => ({ kind: 'set' as const, artist: a(id), set: { artistId: id, day: 'Friday', stageId: stage, start: '', end: '' }, from, to, setStart: from, setEnd: to, match: 1, pinned: false, known: true });
    // The crew is at X on Main from 22:00 to 23:00 while Sam goes to Y in the tent (22:00–23:15); then Z on Main at 23:30.
    const day: CrewDay = {
      day: 'Friday',
      stops: [stop('x', 'main', 1320, 1380), stop('z', 'main', 1410, 1470)],
      starredBy: {},
      splits: [{ artist: a('y'), set: { artistId: 'y', day: 'Friday', stageId: 'tent', start: '22:00', end: '23:15' }, who: ['sam'], during: a('x'), backAt: '23:15' }],
    };
    const [s] = suggestMeetups(festival, [day], 'The big tree', () => 'Sam');
    expect(s).toEqual(expect.objectContaining({ day: 'Friday', minute: 1405, place: 'Main Stage', before: 'Z' }));
    expect(new Date(s.atMs!).getHours()).toBe(23);
    expect(new Date(s.atMs!).getMinutes()).toBe(25);
    // Nothing on after: the meeting spot.
    expect(suggestMeetups(festival, [{ ...day, stops: [stop('x', 'main', 1320, 1380)] }], 'The big tree', () => 'Sam')[0].place).toBe('The big tree');
  });
});
