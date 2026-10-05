import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival, SetTime } from '../../../data/types';
import {
  BREAK_LABEL_MAX,
  cleanHours,
  dayRange,
  fixLabel,
  freeMinutes,
  hoursLine,
  hoursSaid,
  isAllDay,
  makeRoom,
  MAX_BREAKS,
  missedBy,
  missedLine,
  newBreak,
  stepTime,
  timeRange,
} from '../hours';
import { dayRoute, festivalRoute, type RouteInput, type RouteStop } from '../route';

// Minutes on the festival clock: 19:00 = 1140, 20:00 = 1200, 00:00 = 1440, 01:00 = 1500.
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
const input = (f: Festival, taste: Record<string, number>, extra: Partial<RouteInput> = {}): RouteInput => ({
  festival: f,
  artists: f.lineup.map(artist),
  taste,
  informed: Object.fromEntries(Object.keys(taste).map((k) => [k, true])),
  ...extra,
});
const summary = (stops: ReturnType<typeof dayRoute>['stops']) =>
  stops.map((s) => (s.kind === 'break' ? `${s.label ?? (s.yours ? 'yours' : 'break')} ${s.from}-${s.to}` : `${s.artist.id} ${s.from}-${s.to}`));

describe('your hours', () => {
  it('tidies hours: arrive before leave, breaks inside, merged and sorted, capped and trimmed', () => {
    expect(cleanHours(undefined)).toBeUndefined();
    expect(cleanHours({ breaks: [] })).toBeUndefined();
    expect(cleanHours({ arrive: 1300, leave: 1200, breaks: [] })).toEqual({ arrive: 1300, breaks: [] });
    expect(
      cleanHours({
        arrive: 1200,
        leave: 1500,
        breaks: [
          { from: 1400, to: 1600, label: 'Rest' },
          { from: 1100, to: 1230, label: '  Dinner with the whole crew and more  ' },
          { from: 1220, to: 1260, label: 'Food' },
          { from: 1300, to: 1300 },
          'junk',
        ],
      }),
    ).toEqual({
      arrive: 1200,
      leave: 1500,
      breaks: [
        { from: 1200, to: 1260, label: 'Dinner with the whole cr'.slice(0, BREAK_LABEL_MAX).trim() },
        { from: 1400, to: 1500, label: 'Rest' },
      ],
    });
    const many = cleanHours({ breaks: [0, 1, 2, 3, 4, 5].map((i) => ({ from: 1200 + i * 30, to: 1210 + i * 30 })) });
    expect(many?.breaks).toHaveLength(MAX_BREAKS);
    expect(isAllDay(undefined)).toBe(true);
    expect(isAllDay({ breaks: [] })).toBe(true);
    expect(isAllDay({ leave: 1500, breaks: [] })).toBe(false);
  });

  it('says your hours briefly and in full', () => {
    const h = { arrive: 960, leave: 1560, breaks: [{ from: 1140, to: 1200, label: 'Dinner' }] };
    expect(hoursLine(undefined)).toBe('All day');
    expect(hoursLine(h)).toBe('Arriving 4:00 PM · Leaving 2:00 AM · Dinner 7–8 PM');
    expect(hoursLine({ ...h, breaks: [...h.breaks, { from: 1230, to: 1260 }, { from: 1300, to: 1320 }] })).toBe('Arriving 4:00 PM · Leaving 2:00 AM · 3 breaks');
    expect(hoursSaid(h)).toBe('arriving at 4:00 PM, leaving at 2:00 AM, Dinner from 7:00 PM to 8:00 PM');
    expect(hoursSaid(undefined)).toBe('all day');
    expect(timeRange(1140, 1200)).toBe('7:00–8:00 PM');
    expect(timeRange(1410, 1470, true)).toBe('11:30 PM–12:30 AM');
  });

  it('limits times to the day, in 15-minute steps', () => {
    const f = festival([set('a', '22:00', '23:00'), set('b', '00:15', '01:30')]);
    expect(dayRange(f, 'Friday')).toEqual({ first: 1320, last: 1530, min: 1200, max: 1590 });
    expect(dayRange(f, 'Saturday')).toBeUndefined();
    expect(stepTime(1320, 1, 1200, 1590)).toBe(1335);
    expect(stepTime(1327, -1, 1200, 1590)).toBe(1320);
    expect(stepTime(1590, 1, 1200, 1590)).toBe(1590);
    expect(newBreak(undefined, { first: 1200, last: 1440 }, 'Dinner')).toEqual({ from: 1290, to: 1350, label: 'Dinner' });
  });

  it('knows when a set is out of your hours, and how to make room', () => {
    const h = { arrive: 1200, leave: 1440, breaks: [{ from: 1300, to: 1360, label: 'Dinner' }] };
    expect(freeMinutes(h, 1260, 1380)).toBe(60);
    expect(missedBy(h, 1260, 1380)).toBeUndefined();
    const late = missedBy(h, 1500, 1560)!;
    expect(late).toEqual({ why: 'leave', start: 1500, end: 1560 });
    expect(missedLine('SUBTRONICS', late)).toBe('SUBTRONICS plays at 1:00 AM, after you leave. Stay later?');
    expect(fixLabel(late)).toBe('Stay until 2:00 AM');
    expect(makeRoom(h, late)?.leave).toBe(1560);
    const early = missedBy(h, 1100, 1180)!;
    expect(missedLine('A', early)).toBe('A plays at 6:20 PM, before you arrive. Come earlier?');
    expect(makeRoom(h, early)?.arrive).toBe(1100);
    const dinner = missedBy(h, 1310, 1350)!;
    expect(dinner).toEqual({ why: 'break', start: 1310, end: 1350, label: 'Dinner' });
    expect(missedLine('B', dinner)).toBe('B plays at 9:50 PM, during dinner. Move it?');
    expect(fixLabel(dinner)).toBe('Remove dinner');
    expect(makeRoom(h, dinner)?.breaks).toEqual([]);
  });
});

describe('the full-day route in your hours', () => {
  const f = festival([
    set('a', '20:00', '21:00'),
    set('b', '21:00', '22:30'),
    set('c', '22:30', '23:30', 'tent'),
    set('late', '01:00', '02:00', 'tent'),
  ]);
  const taste = { a: 0.8, b: 0.9, c: 0.7, late: 0.8 };

  it('is unchanged with no hours, or hours for another day', () => {
    const plain = festivalRoute(input(f, taste));
    expect(festivalRoute(input(f, taste, { hours: {} }))).toEqual(plain);
    expect(festivalRoute(input(f, taste, { hours: { Saturday: { leave: 1300, breaks: [] } } }))).toEqual(plain);
    expect(festivalRoute(input(f, taste, { hours: { Friday: { breaks: [] } } }))).toEqual(plain);
    expect(plain[0].missed).toBeUndefined();
  });

  it('plans only between arriving and leaving', () => {
    const route = dayRoute(input(f, taste, { hours: { Friday: { arrive: 1230, leave: 1380, breaks: [] } } }), 'Friday');
    expect(summary(route.stops)).toEqual(['a 1230-1260', 'b 1260-1350', 'c 1360-1380']);
    expect(route.missed).toBeUndefined();
  });

  it('keeps your breaks free, cutting a set around one, and names them', () => {
    const route = dayRoute(input(f, taste, { hours: { Friday: { breaks: [{ from: 1290, to: 1320, label: 'Dinner' }] } } }), 'Friday');
    expect(summary(route.stops)).toEqual(['a 1200-1260', 'b 1260-1290', 'Dinner 1290-1320', 'b 1320-1350', 'c 1360-1410', 'break 1410-1500', 'late 1500-1560']);
    const after = route.stops[3] as RouteStop;
    expect(after.from).toBe(1320);
    expect(route.stops[2]).toEqual({ kind: 'break', from: 1290, to: 1320, yours: true, label: 'Dinner' });
  });

  it('reports a must-see your hours leave no time for, instead of dropping it quietly', () => {
    const hours = { Friday: { leave: 1440, breaks: [{ from: 1200, to: 1260, label: 'Dinner' }] } };
    const route = dayRoute(input(f, taste, { hours, pinned: new Set(['late', 'a']) }), 'Friday');
    expect(route.stops.some((s) => s.kind === 'set' && s.artist.id === 'late')).toBe(false);
    expect(route.missed?.map((m) => [m.artist.id, m.why, m.label])).toEqual([
      ['a', 'break', 'Dinner'],
      ['late', 'leave', undefined],
    ]);
    // Staying later puts it back.
    const later = dayRoute(input(f, taste, { hours: { Friday: makeRoom(hours.Friday, route.missed![1])! }, pinned: new Set(['late']) }), 'Friday');
    expect(later.stops.some((s) => s.kind === 'set' && s.artist.id === 'late')).toBe(true);
    expect(later.missed).toBeUndefined();
  });

  it('says what you miss even when nothing at all is in your hours', () => {
    const route = dayRoute(input(f, taste, { hours: { Friday: { arrive: 1600, breaks: [] } }, pinned: new Set(['late']) }), 'Friday');
    expect(route.stops).toEqual([]);
    expect(route.missed?.[0].why).toBe('arrive');
  });
});
