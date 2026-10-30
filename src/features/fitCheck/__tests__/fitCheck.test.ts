import { describe, expect, it } from '@jest/globals';
import type { CrewUpdate } from '../../social/models';
import { cleanFits, crewFits, FIT_NOTE, fitDate, fitsByFestival, keepFit } from '../fitCheck';

describe('fit check', () => {
  it('counts a photo after midnight for the night before', () => {
    expect(fitDate(new Date(2026, 10, 6, 21).getTime())).toBe('2026-11-06');
    expect(fitDate(new Date(2026, 10, 7, 2).getTime())).toBe('2026-11-06');
    expect(fitDate(new Date(2026, 10, 7, 9).getTime())).toBe('2026-11-07');
  });

  it('keeps one fit a day, newest first, and groups them by festival', () => {
    let all = keepFit([], { festivalId: 'edc', date: '2026-11-06', uri: 'a', at: 1 });
    all = keepFit(all, { festivalId: 'edc', date: '2026-11-07', uri: 'b', at: 2 });
    all = keepFit(all, { festivalId: 'edc', date: '2026-11-06', uri: 'c', at: 3 });
    expect(all.map((f) => f.uri)).toEqual(['c', 'b']);
    expect(fitsByFestival(all)[0].fits.map((f) => f.date)).toEqual(['2026-11-06', '2026-11-07']);
    expect(cleanFits([{ festivalId: 'x', date: 'nope', uri: 'u', at: 1 }, { festivalId: 'x', date: '2026-01-01', uri: 'u', at: 1, sent: true }])).toEqual([{ festivalId: 'x', date: '2026-01-01', uri: 'u', at: 1, sent: true }]);
  });

  it('shows crewmates’ fits for the day (their latest each), never yours', () => {
    const u = (id: string, uid: string, at: Date, note = FIT_NOTE): CrewUpdate => ({ id, crewId: 'c', uid, kind: 'photo', at: at.toISOString(), sentAt: at.toISOString(), festivalId: 'edc', note, thumbUrl: `https://x/${id}.jpg` });
    const list = [u('1', 'maya', new Date(2026, 10, 6, 18)), u('2', 'maya', new Date(2026, 10, 6, 20)), u('3', 'me', new Date(2026, 10, 6, 19)), u('4', 'sam', new Date(2026, 10, 6, 19), 'At the main stage'), u('5', 'jo', new Date(2026, 10, 7, 1))];
    expect(crewFits(list, 'edc', '2026-11-06', 'me').map((x) => x.id)).toEqual(['2', '5']);
  });
});
