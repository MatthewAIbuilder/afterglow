import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { DOORS, cleanOpened, doorFor, festivalWeek, isUnlocked, weekLine, type WeekFacts } from '../week';

const fest = (over: Partial<Festival> = {}): Festival =>
  ({ id: 'cc', name: 'Cyclops Cove 4', dates: 'x', location: 'Boca Raton', lineup: [], days: ['Friday', 'Saturday', 'Sunday'], stages: [], startDate: '2026-12-04', endDate: '2026-12-06', ...over }) as Festival;
const facts = (over: Partial<WeekFacts> = {}): WeekFacts => ({
  festivalName: 'Cyclops Cove 4',
  topPicks: [],
  leftToRate: 0,
  lineup: 52,
  clips: 0,
  prep: { done: 2, total: 10 },
  setTimes: false,
  onMap: true,
  ...over,
});

describe('festival week', () => {
  it('is the seven days before it starts, and the day itself', () => {
    expect(festivalWeek(fest(), new Date(2026, 10, 26))).toBeUndefined();
    expect(festivalWeek(fest(), new Date(2026, 10, 27))).toEqual({ until: 7 });
    expect(festivalWeek(fest(), new Date(2026, 11, 3))).toEqual({ until: 1 });
    expect(festivalWeek(fest(), new Date(2026, 11, 4))).toEqual({ until: 0 });
    expect(festivalWeek(fest(), new Date(2026, 11, 5))).toBeUndefined();
    // A two-weekend festival counts down to its first weekend only (pick weekend 2 to count down to that).
    const acl = fest({ startDate: '2026-10-02', endDate: '2026-10-11', weekends: [{ start: '2026-10-02', end: '2026-10-04' }, { start: '2026-10-09', end: '2026-10-11' }] });
    expect(festivalWeek(acl, new Date(2026, 8, 30))).toEqual({ until: 2 });
    expect(festivalWeek(acl, new Date(2026, 9, 6))).toBeUndefined();
    expect(festivalWeek(fest({ startDate: undefined, endDate: undefined }), new Date(2026, 11, 1))).toBeUndefined();
  });

  it('opens a door a day, from a week out to the day before', () => {
    expect(DOORS).toEqual([7, 6, 5, 4, 3, 2, 1]);
    expect(DOORS.filter((d) => isUnlocked(d, 3))).toEqual([7, 6, 5, 4, 3]);
    expect(weekLine(3, new Set())).toBe('5 doors to open');
    expect(weekLine(3, new Set([7, 6, 5, 4]))).toBe('Door 3 is ready to open');
    expect(weekLine(3, new Set([7, 6, 5, 4, 3]))).toBe('Next door opens tomorrow · 3 days to go');
    expect(weekLine(1, new Set(DOORS))).toBe('All doors open. See you tomorrow.');
  });

  it('each door is about where your plan is', () => {
    expect(doorFor(7, facts({ topPicks: ['SUBTRONICS', 'LEVITY', 'KNOCK2', 'X'] })).line).toBe('A week to go. Your must-sees so far: SUBTRONICS, LEVITY and KNOCK2.');
    expect(doorFor(7, facts()).action?.kind).toBe('tune');
    expect(doorFor(6, facts({ leftToRate: 40 })).line).toMatch(/^40 of 52 acts aren’t rated yet/);
    expect(doorFor(5, facts({ warmup: { url: 'https://www.youtube.com/watch_videos?video_ids=a,b', count: 2 } })).action).toMatchObject({ kind: 'warmup' });
    expect(doorFor(5, facts({ clips: 8 })).action?.kind).toBe('discover');
    expect(doorFor(4, facts()).action?.kind).toBe('start-crew');
    expect(doorFor(4, facts({ crew: { id: 'c1', name: 'Bass crew', people: 3 } })).action).toMatchObject({ kind: 'chat', crewId: 'c1' });
    expect(doorFor(3, facts({ crew: { id: 'c1', name: 'Bass crew', people: 3, meetSpot: 'By the big tree' } })).line).toMatch(/^“By the big tree”/);
    expect(doorFor(2, facts()).line).toMatch(/^2 of 10 done/);
    expect(doorFor(2, facts({ prep: { done: 10, total: 10 } })).title).toBe('Packed and ready');
    expect(doorFor(1, facts({ setTimes: true })).action?.label).toBe('See your route');
  });

  it('reads what was opened back carefully', () => {
    expect(cleanOpened({ cc: [7, 7, 6, 9, 'x'], other: [] , bad: 'x' })).toEqual({ cc: [7, 6] });
    expect(cleanOpened(null)).toEqual({});
  });
});
