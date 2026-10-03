import { describe, expect, it } from '@jest/globals';
import type { AdminPresence } from '../../social/models';
import { activeIn, alerts, contentStats, countBefore, countIn, dailyActive, growth, hourLabel, peopleStats, retention, shortVersion, topBy, trend, trendLabel } from '../metrics';
import { localDay, nextPresence, presenceFromDoc, shouldPing } from '../presence';

const NOW = new Date(2026, 9, 3, 15, 0);
const ago = (days: number, h = 12) => new Date(2026, 9, 3 - days, h).toISOString();
const key = (days: number) => localDay(new Date(2026, 9, 3 - days));
const who = (uid: string, first: number, days: number[], over: Partial<AdminPresence> = {}): AdminPresence => ({
  uid,
  firstSeenAt: ago(first),
  lastSeenAt: ago(Math.min(...days)),
  days: [...days].sort((a, b) => b - a).map(key),
  platform: 'ios',
  version: 'Afterglow 1.0.0 · build 3f2a9c1',
  hasProfile: true,
  ...over,
});

describe('your own last-active record', () => {
  it('keeps the first visit and adds each day once, newest last', () => {
    const a = nextPresence(null, { platform: 'ios', version: 'v', hasProfile: false, now: new Date(2026, 9, 1, 9) });
    expect(a.days).toEqual(['2026-10-01']);
    const b = nextPresence(a, { platform: 'web', version: 'v2', hasProfile: true, now: new Date(2026, 9, 3, 9) });
    const c = nextPresence(b, { platform: 'web', version: 'v2', hasProfile: true, now: new Date(2026, 9, 3, 20) });
    expect(c).toMatchObject({ firstSeenAt: a.firstSeenAt, days: ['2026-10-01', '2026-10-03'], platform: 'web', hasProfile: true });
    const long = nextPresence({ ...c, days: Array.from({ length: 95 }, (_, i) => localDay(new Date(2026, 5, i + 1))) }, { platform: 'ios', version: 'v', hasProfile: true, now: NOW });
    expect(long.days).toHaveLength(90);
    expect(long.days[89]).toBe('2026-10-03');
  });

  it('writes again on a new day, a new profile, or after 15 minutes', () => {
    const last = { day: '2026-10-03', at: NOW.getTime(), hasProfile: true };
    expect(shouldPing(undefined, NOW, true)).toBe(true);
    expect(shouldPing(last, new Date(NOW.getTime() + 5 * 60_000), true)).toBe(false);
    expect(shouldPing(last, new Date(NOW.getTime() + 16 * 60_000), true)).toBe(true);
    expect(shouldPing(last, new Date(NOW.getTime() + 60_000), false)).toBe(true);
    expect(shouldPing(last, new Date(2026, 9, 4, 0, 1), true)).toBe(true);
  });

  it('reads back safely', () => {
    expect(presenceFromDoc('a', { firstSeenAt: 'x', lastSeenAt: ago(0) })).toBeNull();
    expect(presenceFromDoc('a', { firstSeenAt: ago(1), lastSeenAt: ago(0), days: ['2026-10-03', 4, 'nope'], hasProfile: 'yes' })).toEqual({ uid: 'a', firstSeenAt: ago(1), lastSeenAt: ago(0), days: ['2026-10-03'], hasProfile: false });
  });
});

describe('who is active', () => {
  const list = [
    who('today', 20, [0, 1, 5, 20]),
    who('new', 2, [2], { platform: 'android', hasProfile: false }),
    who('month', 40, [12, 40], { platform: 'web', version: 'Afterglow 0.9.0' }),
    who('gone', 100, [70, 100]),
    { ...who('hour', 0, [0]), lastSeenAt: new Date(NOW.getTime() - 20 * 60_000).toISOString() },
  ];

  it('counts today, this week, this month and the inactive', () => {
    const s = peopleStats(list, NOW);
    expect(s).toMatchObject({ accounts: 5, withProfile: 4, onlineHour: 1, today: 2, week: 3, month: 4, inactive: 1, stickiness: 50, newThisWeek: 2, returningThisWeek: 1 });
    expect(s.buckets.map((b) => b.n)).toEqual([2, 1, 1, 1, 0]);
    expect(s.platforms).toEqual([
      { key: 'ios', label: 'iPhone', n: 2, pct: 50 },
      { key: 'android', label: 'Android', n: 1, pct: 25 },
      { key: 'web', label: 'Website', n: 1, pct: 25 },
    ]);
    expect(s.versions[0]).toMatchObject({ label: '1.0.0 · 3f2a9c1', n: 3 });
    expect(shortVersion('Afterglow 0.9.0')).toBe('0.9.0');
    expect(s.daysPerMonth).toBe(1.8);
    expect(peopleStats([], NOW)).toMatchObject({ accounts: 0, inactive: 0 });
    expect(peopleStats([], NOW).stickiness).toBeUndefined();
  });

  it('counts each day people opened the app', () => {
    const d = dailyActive(list, 7, NOW);
    expect(d.map((x) => x.n)).toEqual([0, 1, 0, 0, 1, 1, 2]);
    expect(activeIn(list, 7, NOW)).toBe(3);
  });

  it('works out who came back, by the week they arrived', () => {
    const c = retention([who('a', 20, [20, 19, 1]), who('b', 18, [18]), who('c', 3, [3, 2]), who('d', 2, [2])], NOW, 3);
    expect(c[0]).toMatchObject({ size: 2, cameBack: 50, activeNow: 100 });
    expect(c[0].afterWeek).toBeUndefined();
    expect(c[1].size).toBe(0);
    expect(c[2]).toMatchObject({ size: 2, cameBack: 50, afterWeek: 50, activeNow: 50 });
    expect(c[0].label).toBe('Sep 27 to Oct 3');
  });
});

describe('what people made', () => {
  it('compares a range with the one before it', () => {
    const t = [ago(0), ago(3), ago(8), ago(9), ago(12), ago(30)];
    expect(countIn(t, 7, NOW)).toBe(2);
    expect(countBefore(t, 7, NOW)).toBe(3);
    expect(trend(t, 7, NOW)).toEqual({ now: 2, before: 3, change: -33 });
    expect(trendLabel(trend(t, 7, NOW), 7)).toBe('▼ 33% vs the 7 days before');
    expect(trendLabel({ now: 3, before: 0 }, 30)).toBe('New in the last 30 days');
    expect(trendLabel({ now: 0, before: 0 }, 30)).toBe('');
  });

  it('runs a total back day by day', () => {
    const g = growth(10, [ago(0), ago(0), ago(2)], 4, NOW);
    expect(g.map((d) => d.n)).toEqual([7, 8, 8, 10]);
  });

  it('ranks sharers, artists and festivals, and finds the busiest hour', () => {
    const v = (uid: string, d: number, h: number, artistId?: string) => ({ createdAt: ago(d, h), uid, handle: uid, artistId, festivalId: 'cc4', durationSec: 30 });
    const s = contentStats(
      { videos: [v('maya', 0, 22, 'subtronics'), v('maya', 1, 22, 'subtronics'), v('sam', 2, 23, 'levity'), v('jo', 40, 9)], likes: [ago(0), ago(1)], comments: [ago(0)], follows: [], crews: [ago(3)] },
      4,
      7,
      NOW,
    );
    expect(s).toMatchObject({ creators: 2, creatorShare: 50, perDay: 0.4, avgLength: 30, likesPerVideo: 0.7, commentsPerVideo: 0.3, busiestHour: 22 });
    expect(s.videos).toEqual({ now: 3, before: 0 });
    expect(s.topCreators[0]).toEqual({ key: 'maya', n: 2, handle: 'maya' });
    expect(s.topArtists).toEqual([{ key: 'subtronics', n: 2 }, { key: 'levity', n: 1 }]);
    expect(topBy(['b', 'a', 'b', undefined], (x) => x, 1)).toEqual([{ key: 'b', n: 2 }]);
    expect(hourLabel(0)).toBe('12 AM');
    expect(hourLabel(13)).toBe('1 PM');
  });

  it('says what needs a look', () => {
    expect(alerts({ supportOpen: 2, reportsOpen: 1, signups: { now: 2, before: 10, change: -80 }, days: 30 }).map((a) => a.text)).toEqual([
      '1 report needs a look.',
      '2 support messages are waiting for a reply.',
      'Sign-ups are down 80% on the 30 days before.',
    ]);
    expect(alerts({ supportOpen: 0, reportsOpen: 0, signups: { now: 1, before: 0 }, days: 7 })).toEqual([]);
  });
});
