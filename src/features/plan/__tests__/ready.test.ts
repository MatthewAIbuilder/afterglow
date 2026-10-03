import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival } from '../../../data/types';
import { readyFestival, routePreview, routeSummary } from '../ready';
import type { DayRoute, RouteStop } from '../route';

const fest = (id: string, extra: Partial<Festival> = {}): Festival =>
  ({ id, name: id, dates: '', location: '', lineup: [], days: [], stages: [], ...extra }) as unknown as Festival;
const stop = (id: string, from: number): RouteStop =>
  ({ kind: 'set', artist: { id, name: id } as Artist, set: { artistId: id, day: 'Friday', stageId: 'main', start: '22:00', end: '23:00' }, from, to: from + 60, setStart: from, setEnd: from + 60, match: 0.8, pinned: false, known: true }) as RouteStop;

describe('lineup ready', () => {
  const today = new Date(2026, 9, 3);
  const sets = [{ artistId: 'a', day: 'Friday', stageId: 'main', start: '22:00', end: '23:00' }];

  it('picks the first festival you are going to that has set times and is not over', () => {
    const over = fest('over', { sets, startDate: '2026-01-01', endDate: '2026-01-02' } as Partial<Festival>);
    const noTimes = fest('no-times', { startDate: '2026-11-01', endDate: '2026-11-02' } as Partial<Festival>);
    const ready = fest('ready', { sets, startDate: '2026-12-01', endDate: '2026-12-02' } as Partial<Festival>);
    expect(readyFestival([over, noTimes, ready], today)?.id).toBe('ready');
    expect(readyFestival([over, noTimes], today)).toBeUndefined();
  });

  it('previews the first day with sets, and sums up the route', () => {
    const route: DayRoute[] = [
      { day: 'Thursday', stops: [] },
      { day: 'Friday', stops: [stop('a', 1320), { kind: 'break', from: 1380, to: 1400 }, stop('b', 1400), stop('c', 1460), stop('d', 1520)] },
      { day: 'Saturday', stops: [stop('e', 1320)] },
    ];
    expect(routePreview(route)).toMatchObject({ day: 'Friday', more: 1 });
    expect(routePreview(route)!.stops.map((s) => s.artist.id)).toEqual(['a', 'b', 'c']);
    expect(routeSummary(route)).toBe('5 sets over 2 days');
    expect(routePreview([])).toBeUndefined();
    expect(routeSummary(undefined)).toBeUndefined();
  });
});
