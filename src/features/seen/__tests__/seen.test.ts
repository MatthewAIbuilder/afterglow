import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/types';
import type { DayRoute } from '../../plan/route';
import { askables, rateReminders } from '../ask';
import { cleanSeen, markSeen, ratingAfter, seenByFestival, seenFromMemories, seenKey, setsToAsk, timesSeen, unmarkSeen } from '../seen';

describe('sets you have seen', () => {
  it('keeps a verdict until a new one, and forgets a set you were not at', () => {
    let all = markSeen({}, { festivalId: 'f', artistId: 'a', day: 'Friday', at: 1, verdict: 'great' });
    all = markSeen(all, { festivalId: 'f', artistId: 'a', day: 'Friday', at: 2 });
    expect(all[seenKey('f', 'a', 'Friday')]).toEqual({ festivalId: 'f', artistId: 'a', day: 'Friday', at: 2, verdict: 'great' });
    all = markSeen(all, { festivalId: 'f', artistId: 'a', day: 'Friday', at: 3, verdict: 'unreal' });
    expect(all[seenKey('f', 'a', 'Friday')].verdict).toBe('unreal');
    expect(unmarkSeen(all, 'f', 'a', 'Friday')).toEqual({});
    expect(cleanSeen({ x: { festivalId: 'f', artistId: 'a', at: 1, verdict: 'wow' }, y: 'no' })).toEqual({ 'f:a:': { festivalId: 'f', artistId: 'a', at: 1 } });
  });

  it('only ever warms up an artist rating', () => {
    expect(ratingAfter(undefined, 'unreal')).toBe('love');
    expect(ratingAfter('ok', 'great')).toBe('like');
    expect(ratingAfter('love', 'meh')).toBeUndefined();
    expect(ratingAfter(undefined, 'meh')).toBe('meh');
  });

  it('groups what you saw and filmed by festival, and counts who you saw most', () => {
    const saved = markSeen(markSeen({}, { festivalId: 'edc', artistId: 'a', at: 10, verdict: 'unreal' }), { festivalId: 'ultra', artistId: 'a', at: 50 });
    const filmed = seenFromMemories([
      { capturedAt: new Date(20).toISOString(), festivalId: 'edc', artistId: 'b' },
      { capturedAt: new Date(12).toISOString(), festivalId: 'edc', artistId: 'a' },
      { capturedAt: new Date(5).toISOString(), artistId: 'c' },
    ]);
    const groups = seenByFestival(saved, filmed);
    expect(groups.map((g) => g.festivalId)).toEqual(['ultra', 'edc']);
    expect(groups[1].sets.map((s) => `${s.artistId}${s.filmed ? '+filmed' : ''}${s.verdict ? `:${s.verdict}` : ''}`)).toEqual(['a+filmed:unreal', 'b+filmed']);
    expect(timesSeen(groups)[0]).toEqual({ artistId: 'a', times: 2, last: 50 });
  });
});

describe('how was it?', () => {
  const festival = { id: 'f', name: 'F', dates: '', location: '', lineup: ['a', 'b'], days: ['Friday'], stages: [], startDate: '2026-11-06', endDate: '2026-11-06' } as Festival;
  const stop = (id: string, from: number, to: number) => ({ kind: 'set' as const, artist: { id, name: id.toUpperCase(), sound: {} }, set: { artistId: id, day: 'Friday', stageId: 's', start: '', end: '' }, from, to, setStart: from, setEnd: to, match: 1, pinned: false, known: true });
  // 22:00–23:00 and a 10 minute stint after.
  const route: DayRoute[] = [{ day: 'Friday', stops: [stop('a', 1320, 1380), stop('b', 1380, 1390)] }];

  it('asks about sets you were at long enough, once each, a few minutes after', () => {
    const list = askables(festival, route);
    expect(list).toHaveLength(1);
    expect(new Date(list[0].endsAt).getHours()).toBe(23);
    const reminders = rateReminders(festival, route, (id) => id.toUpperCase(), new Date(2026, 10, 6, 12));
    expect(reminders.map((r) => [r.title, r.at.getHours(), r.at.getMinutes(), r.href])).toEqual([['How was A?', 23, 5, '/rate-set?festival=f&artist=a&day=Friday']]);
    // In the app: asked after it ends, not once answered or waved off, and not hours later.
    const end = list[0].endsAt;
    expect(setsToAsk(list, {}, new Set(), end - 1)).toEqual([]);
    expect(setsToAsk(list, {}, new Set(), end + 60_000)).toHaveLength(1);
    expect(setsToAsk(list, markSeen({}, { festivalId: 'f', artistId: 'a', day: 'Friday', at: end, verdict: 'good' }), new Set(), end + 60_000)).toEqual([]);
    expect(setsToAsk(list, {}, new Set([seenKey('f', 'a', 'Friday')]), end + 60_000)).toEqual([]);
    expect(setsToAsk(list, {}, new Set(), end + 4 * 3600_000)).toEqual([]);
  });
});
