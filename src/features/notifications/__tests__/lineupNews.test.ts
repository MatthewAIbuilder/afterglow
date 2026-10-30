import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { cleanLineupMemory, EMPTY_LINEUP_MEMORY, justAdded, lineupNotices, NEWS_DAYS, trackLineups } from '../lineupNews';

const DAY = 24 * 60 * 60 * 1000;
const fest = (id: string, lineup: string[], over: Partial<Festival> = {}): Festival =>
  ({ id, name: id.toUpperCase(), dates: '', location: '', lineup, days: [], stages: [], startDate: '2026-12-04', endDate: '2026-12-06', ...over }) as Festival;
const today = new Date('2026-10-01T12:00:00');
const names: Record<string, string> = { a: 'ALPHA', b: 'BRAVO', c: 'CHARLIE', d: 'DELTA' };
const opts = (loves: string[], going: string[] = []) => ({
  loves: (id: string) => loves.includes(id),
  nameOf: (id: string) => names[id],
  going: new Set(going),
  today,
});

describe('lineup news', () => {
  it('the first look only takes note', () => {
    const m = trackLineups(EMPTY_LINEUP_MEMORY, [fest('f', ['a', 'b'])], 1);
    expect(m.news).toEqual([]);
    expect(m.seen).toEqual({ f: ['a', 'b'] });
    expect(trackLineups(m, [fest('f', ['b', 'a'])], 2)).toBe(m);
  });

  it('notices added acts and new festivals, never the same act twice', () => {
    let m = trackLineups(EMPTY_LINEUP_MEMORY, [fest('f', ['a'])], 1);
    m = trackLineups(m, [fest('f', ['a', 'b', 'c']), fest('g', ['d'])], 2);
    expect(m.news).toEqual([
      { festivalId: 'f', artists: ['b', 'c'], at: 2 },
      { festivalId: 'g', artists: ['d'], newFestival: true, at: 2 },
    ]);
    // An older lineup for a moment, then the newer one again: nothing new.
    m = trackLineups(m, [fest('f', ['a'])], 3);
    m = trackLineups(m, [fest('f', ['a', 'b', 'c'])], 4);
    expect(m.news).toHaveLength(2);
    expect([...justAdded(m, 'f', 5)]).toEqual(['b', 'c']);
    expect([...justAdded(m, 'g', 5)]).toEqual([]);
    expect([...justAdded(m, 'f', 2 + 15 * DAY)]).toEqual([]);
  });

  it('forgets old news', () => {
    let m = trackLineups(EMPTY_LINEUP_MEMORY, [fest('f', ['a'])], 0);
    m = trackLineups(m, [fest('f', ['a', 'b'])], 1);
    expect(trackLineups(m, [fest('f', ['a', 'b'])], 1 + NEWS_DAYS * DAY).news).toEqual([]);
  });

  it('the bell mentions only acts you’d love, on festivals not over', () => {
    const news = [
      { festivalId: 'f', artists: ['a', 'b', 'c'], at: 2 },
      { festivalId: 'g', artists: ['d'], newFestival: true, at: 3 },
      { festivalId: 'old', artists: ['a'], at: 4 },
    ];
    const festivals = [fest('f', ['a', 'b', 'c']), fest('g', ['d']), fest('old', ['a'], { startDate: '2026-01-01', endDate: '2026-01-02' })];
    const n = lineupNotices(news, { festivals, ...opts(['a', 'c', 'd'], ['f']) });
    expect(n.map((x) => [x.title, x.body])).toEqual([
      ['G is on Afterglow', 'DELTA plays. See the lineup.'],
      ['ALPHA and CHARLIE were added to F', 'See how it changes your plan.'],
    ]);
    expect(n[1]).toMatchObject({ id: 'lineup:f:2', kind: 'lineup', href: '/festival/f' });
    expect(lineupNotices(news, { festivals, ...opts(['a', 'b', 'c']) })[0].title).toBe('ALPHA, BRAVO and 1 more you’d love were added to F');
    expect(lineupNotices(news, { festivals, ...opts([]) })).toEqual([]);
  });

  it('a new show is news only near you, as an artist you love playing nearby', () => {
    const news = [
      { festivalId: 'show:near', artists: ['a'], newFestival: true, at: 5 },
      { festivalId: 'show:far', artists: ['a'], newFestival: true, at: 6 },
    ];
    const festivals = [fest('show:near', ['a'], { name: 'Alpha at The Vanguard' }), fest('show:far', ['a'])];
    const km: Record<string, number> = { 'show:near': 12, 'show:far': 900 };
    const n = lineupNotices(news, { festivals, ...opts(['a']), isShow: (f) => f.id.startsWith('show:'), showDistance: (f) => km[f.id], distanceText: (k) => `${k} km` });
    expect(n.map((x) => [x.title, x.body])).toEqual([['ALPHA plays near you', expect.stringMatching(/^Alpha at The Vanguard · .+ · 12 km$/)]]);
    // Without knowing where you are, shows say nothing.
    expect(lineupNotices(news, { festivals, ...opts(['a']), isShow: (f) => f.id.startsWith('show:') })).toEqual([]);
  });

  it('many new festivals at once (the nightly feed) become one notice', () => {
    const ids = ['p', 'q', 'r', 's', 't'];
    const festivals = [...ids.map((id, i) => fest(id, [['a', 'b', 'c', 'd', 'a'][i]])), fest('f', ['a', 'b'])];
    const news = [
      ...ids.map((id, i) => ({ festivalId: id, artists: [['a', 'b', 'c', 'd', 'a'][i]], newFestival: true, at: 5 })),
      { festivalId: 'f', artists: ['b'], at: 5 },
    ];
    const n = lineupNotices(news, { festivals, ...opts(['a', 'b', 'c']) });
    expect(n.map((x) => [x.title, x.body, x.href])).toEqual([
      ['BRAVO was added to F', 'See the full lineup.', '/festival/f'],
      ['4 new festivals with artists you’d love', 'ALPHA, BRAVO and 1 more you’d love play. See them on Festivals.', '/festivals'],
    ]);
    expect(n[1].id).toBe('lineup:new:5');
    // Three or fewer still get their own notices.
    expect(lineupNotices(news.slice(0, 3), { festivals, ...opts(['a', 'b', 'c']) })).toHaveLength(3);
  });

  it('acts not playing your weekend are left out', () => {
    const n = lineupNotices([{ festivalId: 'f', artists: ['a', 'b'], at: 1 }], { festivals: [fest('f', ['a'])], ...opts(['a', 'b']) });
    expect(n[0].title).toBe('ALPHA was added to F');
  });

  it('reads a saved memory safely', () => {
    expect(cleanLineupMemory(null)).toEqual(EMPTY_LINEUP_MEMORY);
    expect(cleanLineupMemory({ seen: { f: ['a', 3] }, news: [{ festivalId: 'f', artists: ['b'], at: 1 }, { at: 'x' }, 5] })).toEqual({
      seen: { f: ['a'] },
      news: [{ festivalId: 'f', artists: ['b'], at: 1 }],
    });
  });
});
