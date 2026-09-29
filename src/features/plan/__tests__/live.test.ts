import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival, SetTime } from '../../../data/models';
import { festivalNight, liveNow, liveRoute } from '../live';
import { festivalRoute } from '../route';
import { buildSchedule, type Pick } from '../plan';

const artist = (id: string): Artist => ({ id, name: id.toUpperCase(), sound: { dubstep: 1 } });
const set = (artistId: string, day: string, start: string, end: string): SetTime => ({
  artistId,
  day,
  stageId: 'main',
  start,
  end,
});
const SETS = [
  set('early', 'Friday', '20:00', '21:00'),
  set('headliner', 'Friday', '23:00', '00:30'),
  set('late', 'Friday', '01:00', '02:00'),
  set('rival', 'Friday', '01:00', '02:00'),
  set('newbie', 'Friday', '21:15', '22:15'),
  set('sunday', 'Sunday', '22:00', '23:00'),
];
const festival: Festival = {
  id: 'f',
  name: 'Fest',
  dates: 'Nov 6 to 8',
  location: 'Somewhere',
  lineup: ['early', 'headliner', 'late', 'rival', 'newbie', 'sunday'],
  days: ['Friday', 'Saturday', 'Sunday'],
  stages: [{ id: 'main', name: 'Main Stage' }],
  sets: SETS,
  startDate: '2026-11-06',
  endDate: '2026-11-08',
};
const pick = (id: string, match: number, tier: Pick['tier'] = 'strong'): Pick => ({
  artist: artist(id),
  match,
  tier,
  pinned: false,
  known: true,
  set: SETS.find((s) => s.artistId === id),
});
const picks = [
  pick('headliner', 0.95, 'must-see'),
  pick('early', 0.8),
  pick('late', 0.8),
  pick('rival', 0.79),
  pick('newbie', 0.4, 'explore'),
  pick('sunday', 0.8),
];
const schedule = buildSchedule(festival, picks);
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m);
const names = (list?: { artist: Artist }[]) => list?.map((p) => p.artist.id);

describe('which festival night it is', () => {
  it('runs noon to noon, from the first date', () => {
    expect(festivalNight(festival, at(6, 11, 59))).toBeUndefined();
    expect(festivalNight(festival, at(6, 12))).toEqual({ day: 'Friday', minute: 720 });
    expect(festivalNight(festival, at(6, 23, 30))).toEqual({ day: 'Friday', minute: 1410 });
    // 1 AM on Saturday's date is still Friday night, past 24:00.
    expect(festivalNight(festival, at(7, 1))).toEqual({ day: 'Friday', minute: 1500 });
    expect(festivalNight(festival, at(7, 13))).toEqual({ day: 'Saturday', minute: 780 });
    expect(festivalNight(festival, at(9, 3))).toEqual({ day: 'Sunday', minute: 1620 });
    expect(festivalNight(festival, at(9, 12))).toBeUndefined();
  });

  it('needs dates, and a day for each date', () => {
    expect(festivalNight({ ...festival, endDate: undefined }, at(6, 20))).toBeUndefined();
    expect(festivalNight({ ...festival, startDate: undefined }, at(6, 20))).toBeUndefined();
    expect(festivalNight({ ...festival, days: ['Friday', 'Saturday'] }, at(6, 20))).toBeUndefined();
  });
});

describe('now and next on your plan', () => {
  it('says who is on and who is next', () => {
    const live = liveNow(festival, schedule, at(6, 20, 30))!;
    expect(names(live.now)).toEqual(['early']);
    expect(names(live.next)).toEqual(['newbie']);
    expect(live.nextIsDiscovery).toBe(true);
  });

  it('finds the next set when nothing is on, across midnight', () => {
    const live = liveNow(festival, schedule, at(6, 22, 30))!;
    expect(live.now).toEqual([]);
    expect(names(live.next)).toEqual(['headliner']);
    const after = liveNow(festival, schedule, at(7, 0, 15))!;
    expect(names(after.now)).toEqual(['headliner']);
  });

  it('gives both sets of a close call', () => {
    const live = liveNow(festival, schedule, at(7, 1, 30))!;
    expect(names(live.now)?.sort()).toEqual(['late', 'rival']);
    expect(live.next).toBeUndefined();
  });

  it('is quiet on a night with nothing planned, and outside the festival', () => {
    const saturday = liveNow(festival, schedule, at(7, 20))!;
    expect(saturday.night.day).toBe('Saturday');
    expect(saturday.now).toEqual([]);
    expect(saturday.next).toBeUndefined();
    expect(liveNow(festival, schedule, at(1, 20))).toBeUndefined();
  });
});

describe('live from the full-day route', () => {
  const taste = { early: 0.8, headliner: 0.95, late: 0.8, rival: 0.79, newbie: 0.4, sunday: 0.8 };
  const informed = Object.fromEntries(Object.keys(taste).map((k) => [k, true]));
  const route = festivalRoute({ festival, artists: festival.lineup.map(artist), taste, informed });

  it('says where the route has you now, and where next', () => {
    const early = liveRoute(festival, route, at(6, 20, 30))!;
    expect(early.now?.artist.id).toBe('early');
    expect(early.next?.artist.id).toBe('newbie');
    const late = liveRoute(festival, route, at(7, 0, 10))!;
    expect(late.now?.artist.id).toBe('headliner');
    expect(late.next?.artist.id).toBe('late');
  });

  it('has nothing on in a gap, and nothing outside the festival', () => {
    const gap = liveRoute(festival, route, at(6, 22, 40))!;
    expect(gap.now).toBeUndefined();
    expect(gap.next?.artist.id).toBe('headliner');
    expect(liveRoute(festival, route, at(5, 20))).toBeUndefined();
  });
});
