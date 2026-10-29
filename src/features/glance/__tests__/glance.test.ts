import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival, SetTime } from '../../../data/models';
import type { DayRoute, RouteStop } from '../../plan/route';
import { activityShow, festivalGlance, nowAndNext, tonightSets } from '../glance';

const festival = {
  id: 'edco',
  name: 'EDC Orlando 2026',
  dates: 'Nov 6 to 8',
  location: 'Tinker Field, Orlando',
  startDate: '2026-11-06',
  endDate: '2026-11-08',
  days: ['Friday', 'Saturday', 'Sunday'],
  stages: [
    { id: 'kinetic', name: 'kineticFIELD' },
    { id: 'circuit', name: 'circuitGROUNDS' },
  ],
  lineup: ['illenium', 'subtronics'],
} as unknown as Festival;
const artist = (id: string, name: string, color?: string) => ({ id, name, ...(color ? { color } : {}) }) as Artist;
const stop = (a: Artist, stageId: string, from: number, to: number, walk?: number): RouteStop =>
  ({ kind: 'set', artist: a, set: { artistId: a.id, day: 'Friday', stageId, start: '', end: '' } as SetTime, from, to, setStart: from, setEnd: to, match: 1, pinned: false, known: true, ...(walk ? { walk } : {}) }) as RouteStop;
const route: DayRoute[] = [
  {
    day: 'Friday',
    stops: [
      stop(artist('subtronics', 'Subtronics', '#FF2D55'), 'circuit', 22 * 60, 23 * 60 + 15),
      { kind: 'break', from: 23 * 60 + 15, to: 23 * 60 + 30 },
      // 00:30 on the festival-day clock is 24:30.
      stop(artist('illenium', 'ILLENIUM'), 'kinetic', 24 * 60 + 30, 25 * 60 + 45, 8),
    ],
  },
];
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m);

describe('festival glance', () => {
  it('turns tonight’s route into clock times, dropping what’s over', () => {
    const sets = tonightSets(festival, route, 'Friday', at(6, 22, 30));
    expect(sets).toEqual([
      { artist: 'Subtronics', stage: 'circuitGROUNDS', start: at(6, 22).getTime(), end: at(6, 23, 15).getTime(), color: '#FF2D55' },
      { artist: 'ILLENIUM', stage: 'kineticFIELD', start: at(7, 0, 30).getTime(), end: at(7, 1, 45).getTime(), walk: 8 },
    ]);
    expect(tonightSets(festival, route, 'Friday', at(7, 0, 0)).map((s) => s.artist)).toEqual(['ILLENIUM']);
  });

  it('is live on a festival night you’re going to, with now and next', () => {
    const g = festivalGlance([festival], ['edco'], () => route, at(6, 22, 30));
    expect(g.kind).toBe('live');
    if (g.kind !== 'live') return;
    expect([g.festival, g.night, g.sets.length]).toEqual(['EDC Orlando 2026', 'Friday', 2]);
    // The night runs to 7 AM the next morning.
    expect(g.until).toBe(at(7, 7).getTime());
    expect(nowAndNext(g.sets, at(6, 22, 30))).toEqual({ now: g.sets[0], next: g.sets[1] });
    // In the break: nothing on, ILLENIUM next.
    expect(nowAndNext(g.sets, at(6, 23, 20))).toEqual({ next: g.sets[1] });
    // After midnight it's still Friday night.
    const late = festivalGlance([festival], ['edco'], () => route, at(7, 1, 0));
    expect(late.kind === 'live' && late.night).toBe('Friday');
  });

  it('is live without sets before set times are out', () => {
    const g = festivalGlance([festival], ['edco'], () => undefined, at(7, 15));
    expect(g).toMatchObject({ kind: 'live', night: 'Saturday', sets: [] });
  });

  it('counts down to the next festival you’re going to, within two months; otherwise nothing', () => {
    expect(festivalGlance([festival], ['edco'], () => undefined, at(1, 12))).toEqual({
      kind: 'countdown',
      festivalId: 'edco',
      festival: 'EDC Orlando 2026',
      place: 'Tinker Field, Orlando',
      startsAt: at(6, 0).getTime(),
    });
    expect(festivalGlance([festival], [], () => undefined, at(1, 12))).toEqual({ kind: 'none' });
    expect(festivalGlance([festival], ['edco'], () => undefined, new Date(2026, 6, 1))).toEqual({ kind: 'none' });
  });
});

describe('the Live Activity', () => {
  it('shows the set on now and the next, going stale when one of them changes', () => {
    const g = festivalGlance([festival], ['edco'], () => route, at(6, 22, 30));
    expect(activityShow(g, at(6, 22, 30))).toEqual({
      festival: 'EDC Orlando 2026',
      night: 'Friday',
      state: {
        nowArtist: 'Subtronics',
        nowStage: 'circuitGROUNDS',
        nowEnd: at(6, 23, 15).getTime(),
        color: '#FF2D55',
        nextArtist: 'ILLENIUM',
        nextStage: 'kineticFIELD',
        nextStart: at(7, 0, 30).getTime(),
        nextWalk: 8,
      },
      staleAt: at(6, 23, 15).getTime(),
    });
    // Between sets: only what's next.
    expect(activityShow(g, at(6, 23, 20))?.state).toEqual({ nextArtist: 'ILLENIUM', nextStage: 'kineticFIELD', nextStart: at(7, 0, 30).getTime(), nextWalk: 8 });
  });

  it('has none once tonight’s route is over, before set times, or away from a festival', () => {
    const g = festivalGlance([festival], ['edco'], () => route, at(6, 22, 30));
    expect(activityShow(g, at(7, 2))).toBeUndefined();
    expect(activityShow(festivalGlance([festival], ['edco'], () => undefined, at(6, 22)), at(6, 22))).toBeUndefined();
    expect(activityShow({ kind: 'none' }, at(6, 22))).toBeUndefined();
  });
});
