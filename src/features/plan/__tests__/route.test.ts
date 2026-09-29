import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival, SetTime } from '../../../data/types';
import { dayRoute, festivalRoute, type RouteStop, stintLabel } from '../route';

const artist = (id: string): Artist => ({ id, name: id.toUpperCase(), sound: {} });
const set = (artistId: string, start: string, end: string, stageId = 'main', day = 'Friday'): SetTime => ({ artistId, day, stageId, start, end });
const festival = (sets: SetTime[]): Festival => ({
  id: 'f',
  name: 'F',
  dates: '',
  location: '',
  lineup: [...new Set(sets.map((s) => s.artistId))],
  days: ['Friday', 'Saturday'],
  stages: [
    { id: 'main', name: 'Main' },
    { id: 'tent', name: 'Tent' },
  ],
  sets,
});
const everyone = (f: Festival) => f.lineup.map(artist);
const summary = (stops: ReturnType<typeof dayRoute>['stops']) =>
  stops.map((s) => (s.kind === 'break' ? `break ${s.from}-${s.to}` : `${s.artist.id} ${s.from}-${s.to}`));
// Minutes on the festival clock: 20:00 = 1200, 00:00 = 1440.

describe('the full-day route', () => {
  it('fills the day set to set, taking the better match in a clash', () => {
    const f = festival([
      set('a', '20:00', '21:00'),
      set('b', '21:00', '22:00', 'main'),
      set('c', '21:00', '22:00', 'tent'),
      set('d', '22:00', '23:30', 'tent'),
    ]);
    const route = dayRoute({ festival: f, artists: everyone(f), taste: { a: 0.8, b: 0.9, c: 0.5, d: 0.7 }, informed: { a: true, b: true, c: true, d: true } }, 'Friday');
    expect(summary(route.stops)).toEqual(['a 1200-1260', 'b 1260-1320', 'd 1320-1410']);
    expect(stintLabel(route.stops[0] as RouteStop)).toBe('Whole set');
  });

  it('leaves one set early to catch more of a much better one', () => {
    const f = festival([set('ok', '20:00', '22:00'), set('love', '21:00', '22:30', 'tent')]);
    const route = dayRoute({ festival: f, artists: everyone(f), taste: { ok: 0.5, love: 0.95 }, informed: { ok: true, love: true } }, 'Friday');
    expect(summary(route.stops)).toEqual(['ok 1200-1260', 'love 1260-1350']);
    expect(stintLabel(route.stops[0] as RouteStop)).toBe('First 60 min');
  });

  it('never skips a must-see it can reach, even over a better match', () => {
    const f = festival([set('star', '21:00', '22:00'), set('top', '21:00', '22:00', 'tent')]);
    const route = dayRoute(
      { festival: f, artists: everyone(f), taste: { star: 0.4, top: 0.99 }, informed: { star: true, top: true }, pinned: new Set(['star']) },
      'Friday',
    );
    expect(summary(route.stops)).toEqual(['star 1260-1320']);
    expect((route.stops[0] as RouteStop).pinned).toBe(true);
  });

  it('fills gaps with discoveries, and suggests a break over artists you do not like', () => {
    const f = festival([set('love', '20:00', '21:00'), set('new', '21:00', '22:00'), set('meh', '22:00', '23:00'), set('love2', '23:00', '00:00')]);
    const route = dayRoute(
      { festival: f, artists: everyone(f), taste: { love: 0.9, meh: 0.05, love2: 0.9 }, informed: { love: true, meh: true, love2: true } },
      'Friday',
    );
    expect(summary(route.stops)).toEqual(['love 1200-1260', 'new 1260-1320', 'break 1320-1380', 'love2 1380-1440']);
    expect((route.stops[1] as RouteStop).known).toBe(false);
  });

  it('does not hop for a few minutes of a slightly better set', () => {
    const f = festival([set('stay', '20:00', '22:00'), set('brief', '21:00', '21:10', 'tent')]);
    const route = dayRoute({ festival: f, artists: everyone(f), taste: { stay: 0.7, brief: 0.8 }, informed: { stay: true, brief: true } }, 'Friday');
    expect(summary(route.stops)).toEqual(['stay 1200-1320']);
  });

  it('runs past midnight, and gives every day its own route', () => {
    const f = festival([set('late', '23:30', '01:00'), set('sat', '22:00', '23:00', 'main', 'Saturday')]);
    const input = { festival: f, artists: everyone(f), taste: { late: 0.8, sat: 0.8 }, informed: { late: true, sat: true } };
    const [fri, sat] = festivalRoute(input);
    expect(summary(fri.stops)).toEqual(['late 1410-1500']);
    expect(summary(sat.stops)).toEqual(['sat 1320-1380']);
    expect(dayRoute(input, 'Sunday').stops).toEqual([]);
  });
});
