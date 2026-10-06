import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival, Show } from '../../../data/models';
import {
  artistNames,
  byMonth,
  datesCount,
  datesOf,
  nextLine,
  shortDate,
  whereArtists,
  whereCounts,
  whereFilter,
  whereTheyPlay,
} from '../where';

const artist = (id: string): Artist => ({ id, name: id.toUpperCase(), sound: {} });
const fest = (id: string, startDate: string | undefined, lineup: string[], extra: Partial<Festival> = {}): Festival => ({
  id,
  name: `Fest ${id}`,
  dates: '',
  location: 'Austin, Texas',
  lineup,
  days: [],
  stages: [],
  ...(startDate ? { startDate, endDate: startDate } : {}),
  ...extra,
});
const show = (id: string, date: string, artistIds: string[], extra: Partial<Show> = {}): Show => ({
  id,
  date,
  venue: `Club ${id}`,
  location: 'Denver, CO',
  link: `https://edmtrain.com/${id}`,
  artistIds,
  ...extra,
});
const today = new Date(2026, 9, 6, 12);
const artists = new Map(['a', 'b', 'c', 'd'].map((id) => [id, artist(id)]));

const festivals = [
  fest('past', '2026-06-01', ['a', 'b']),
  fest('nov', '2026-11-06', ['a', 'b'], { endDate: '2026-11-08', days: ['Friday', 'Saturday', 'Sunday'], artistDays: { b: ['Saturday'] } }),
  fest('jan', '2027-01-15', ['c'], { place: { lat: 1, lon: 1 } }),
  fest('undated', undefined, ['d']),
  fest('acl', '2026-10-02', ['a', 'c'], {
    endDate: '2026-10-11',
    weekends: [
      { start: '2026-10-02', end: '2026-10-04' },
      { start: '2026-10-09', end: '2026-10-11' },
    ],
    artistWeekends: { c: 1 },
  }),
];
const shows = [show('s0', '2026-10-01', ['a']), show('s1', '2026-10-20', ['a', 'b'], { name: 'Halloween Night', place: { lat: 2, lon: 2 } }), show('s2', '2026-11-06', ['c'])];

const build = (ids: string[], going: string[] = []) =>
  whereTheyPlay(ids, {
    artist: (id) => artists.get(id),
    festivalsOf: (id) => festivals.filter((f) => f.lineup.includes(id)),
    showsOf: (id, from) => shows.filter((s) => s.artistIds.includes(id) && (!from || s.date >= from)),
    going,
    today,
    distanceTo: (f) => (f.place ? 120 : undefined),
    showKm: (s) => (s.place ? 900 : undefined),
    nearKm: 500,
  });

describe('where they play', () => {
  it('merges festivals and shows into one date-ordered schedule, one entry per event with all your artists on it', () => {
    const dates = build(['a', 'b', 'c', 'd', 'gone'], ['nov']);
    expect(dates.map((d) => [d.kind, d.date, d.title, d.artists.map((a) => a.id)])).toEqual([
      // ACL weekend 2 only: weekend 1 is over and c plays only that one.
      ['festival', '2026-10-09', 'Fest acl', ['a']],
      ['show', '2026-10-20', 'Halloween Night', ['a', 'b']],
      // Going first on the same day; b plays Saturday, so has their own date.
      ['festival', '2026-11-06', 'Fest nov', ['a']],
      ['show', '2026-11-06', 'Club s2', ['c']],
      ['festival', '2026-11-07', 'Fest nov', ['b']],
      ['festival', '2027-01-15', 'Fest jan', ['c']],
      ['festival', undefined, 'Fest undated', ['d']],
    ]);
    expect(dates[0].weekend).toBe(2);
    expect(dates[2].going).toBe(true);
    expect(dates[1].where).toBe('Club s1, Denver, CO');
    expect(dates[1].km).toBe(900);
    expect(dates[1].near).toBe(false);
    expect(dates[5].near).toBe(true);
  });

  it('filters and counts', () => {
    const dates = build(['a', 'b', 'c', 'd'], ['nov']);
    expect(whereCounts(dates)).toEqual({ all: 7, near: 1, festivals: 5, shows: 2, going: 2 });
    expect(whereFilter(dates, 'shows').map((d) => d.key)).toEqual(['s:s1', 's:s2']);
    expect(whereFilter(dates, 'near').map((d) => d.title)).toEqual(['Fest jan']);
    expect(whereFilter(dates, 'going').every((d) => d.festival?.id === 'nov')).toBe(true);
    expect(whereFilter(dates, 'all')).toHaveLength(7);
  });

  it('groups by month, with the year when it is not this year', () => {
    const months = byMonth(build(['a', 'b', 'c', 'd']), today);
    expect(months.map((m) => [m.title, m.dates.length])).toEqual([
      ['October', 2],
      ['November', 3],
      ['January 2027', 1],
      ['Date to come', 1],
    ]);
  });

  it('lists the same artists as Profile, then everyone else you follow, once each', () => {
    expect(whereArtists(['x', 'a', 'b'], ['b', 'c', 'a'])).toEqual(['x', 'a', 'b', 'c']);
  });

  it('says it plainly', () => {
    const dates = build(['a', 'b', 'c']);
    expect(nextLine(dates)).toBe('Next: A · Fri 9 Oct · Fest acl');
    expect(nextLine(build(['b']))).toBe('Next: B · Tue 20 Oct · Denver');
    expect(nextLine([])).toBeUndefined();
    expect(shortDate('2026-10-18')).toBe('Sun 18 Oct');
    expect(artistNames([artist('a')])).toBe('A');
    expect(artistNames([artist('a'), artist('b')])).toBe('A and B');
    expect(artistNames([artist('a'), artist('b'), artist('c')])).toBe('A, B and C');
    expect(artistNames(['a', 'b', 'c', 'd'].map(artist))).toBe('A, B and 2 more');
    expect(datesOf(dates, 'b').map((d) => d.date)).toEqual(['2026-10-20', '2026-11-07']);
    expect(datesCount(1)).toBe('1 date');
    expect(datesCount(3)).toBe('3 dates');
  });
});
