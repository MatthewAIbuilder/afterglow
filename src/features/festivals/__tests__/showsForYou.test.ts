import { describe, expect, it } from '@jest/globals';
import type { Show } from '../../../data/models';
import {
  addDays,
  dedupeShows,
  filterShows,
  FOLLOW_BOOST,
  rankShow,
  rankShows,
  searchShows,
  showsByDay,
  showsForYou,
  showsInReach,
  SHOWS_FOR_YOU_MAX,
  upcomingShows,
  type ShowTaste,
} from '../showsForYou';

const show = (id: string, date: string, artistIds: string[], extra: Partial<Show> = {}): Show => ({
  id,
  date,
  venue: `Venue ${id}`,
  location: 'Denver, CO',
  link: `https://edmtrain.com/${id}`,
  artistIds,
  ...extra,
});

const taste = (over: Partial<ShowTaste> = {}): ShowTaste => ({
  taste: { love: 0.9, good: 0.7, meh: 0.4, guess: 0.95, gone: 0.99 },
  informed: { love: true, good: true, meh: true, gone: true },
  ratings: { gone: 'pass' },
  isFollowing: () => false,
  ...over,
});

const TODAY = '2026-10-06';
const DENVER = { lat: 39.74, lon: -104.99 };
const MIAMI = { lat: 25.76, lon: -80.19 };

describe('dates', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-10-06', 0)).toBe('2026-10-06');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('nope', 3)).toBe('nope');
  });

  it('keeps upcoming shows within the window, today included', () => {
    const all = [show('a', '2026-10-05', ['love']), show('b', TODAY, ['love']), show('c', '2027-01-03', ['love']), show('d', '2027-01-04', ['love'])];
    expect(upcomingShows(all, TODAY, 90).map((s) => s.id)).toEqual(['b', 'c']);
    expect(upcomingShows(all, TODAY).map((s) => s.id)).toEqual(['b', 'c', 'd']);
  });
});

describe('ranking', () => {
  it('lets the best artist you have not turned down carry a show, best first on the bill', () => {
    const r = rankShow(show('a', TODAY, ['gone', 'meh', 'love']), taste());
    expect(r.best?.id).toBe('love');
    expect(r.match).toBe(0.9);
    expect(r.bill.map((b) => b.id)).toEqual(['love', 'meh', 'gone']);
    // Only a disliked artist: nobody carries it.
    expect(rankShow(show('b', TODAY, ['gone']), taste()).best).toBeUndefined();
  });

  it('puts what the app really knows before a first guess, and lifts artists you follow', () => {
    const ranked = rankShows([show('guess', TODAY, ['guess']), show('meh', TODAY, ['meh']), show('love', TODAY, ['love'])], taste());
    expect(ranked.map((r) => r.show.id)).toEqual(['love', 'meh', 'guess']);
    const followMeh = taste({ isFollowing: (id) => id === 'meh', taste: { love: 0.5, meh: 0.4 } });
    expect(rankShows([show('love', TODAY, ['love']), show('meh', TODAY, ['meh'])], followMeh).map((r) => r.show.id)).toEqual(['meh', 'love']);
    // Following only orders shows: the match shown is still the live one.
    expect(rankShow(show('meh', TODAY, ['meh']), followMeh).match).toBe(0.4);
    expect(FOLLOW_BOOST).toBeGreaterThan(0);
  });

  it('puts shows near you first, then by match and distance', () => {
    const ranked = rankShows(
      [show('far', TODAY, ['love'], { place: MIAMI }), show('near', TODAY, ['meh'], { place: DENVER }), show('nowhere', TODAY, ['good'])],
      taste(),
      DENVER,
    );
    expect(ranked.map((r) => r.show.id)).toEqual(['near', 'far', 'nowhere']);
    expect(ranked[0].near).toBe(true);
    expect(ranked[0].km).toBeLessThan(1);
    expect(ranked[1].near).toBe(false);
  });

  it('drops the same night at the same venue listed twice, keeping the fuller bill', () => {
    const a = show('a', TODAY, ['love'], { venue: 'Echostage' });
    const b = show('b', TODAY, ['love', 'good'], { venue: 'ECHOSTAGE' });
    const c = show('c', '2026-10-07', ['love'], { venue: 'Echostage' });
    expect(dedupeShows([a, b, c, a]).map((s) => s.id)).toEqual(['b', 'c']);
  });
});

describe('shows for you', () => {
  it('picks real matches and people you follow, never a show only a disliked artist plays', () => {
    const all = [show('meh', TODAY, ['meh']), show('love', '2026-10-09', ['love']), show('gone', TODAY, ['gone']), show('guess', TODAY, ['guess']), show('late', '2027-03-01', ['love'])];
    const { picks, forYou } = showsForYou(all, taste(), { today: TODAY });
    expect(forYou).toBe(true);
    expect(picks.map((r) => r.show.id)).toEqual(['love']);
    const following = showsForYou(all, taste({ isFollowing: (id) => id === 'meh' }), { today: TODAY });
    expect(following.picks.map((r) => r.show.id)).toEqual(['love', 'meh']);
  });

  it('caps the shelf', () => {
    const many = Array.from({ length: 30 }, (_, i) => show(`s${i}`, TODAY, ['love'], { venue: `Club ${i}` }));
    expect(showsForYou(many, taste(), { today: TODAY }).picks).toHaveLength(SHOWS_FOR_YOU_MAX);
  });

  it('falls back to the soonest shows, near you first, when nothing is a match yet', () => {
    const fresh = taste({ informed: {}, taste: { a: 0.3, b: 0.3 }, ratings: {} });
    const { picks, forYou } = showsForYou([show('later', '2026-10-20', ['a']), show('soon', '2026-10-08', ['b']), show('close', '2026-11-01', ['a'], { place: DENVER })], fresh, {
      today: TODAY,
      here: DENVER,
    });
    expect(forYou).toBe(false);
    expect(picks.map((r) => r.show.id)).toEqual(['close', 'soon', 'later']);
  });

  it('is empty without shows', () => {
    expect(showsForYou([], taste(), { today: TODAY })).toEqual({ picks: [], forYou: false });
  });
});

describe('filters and search', () => {
  const all = rankShows(
    [show('today', TODAY, ['love'], { place: DENVER }), show('week', '2026-10-12', ['love']), show('month', '2026-11-05', ['love']), show('later', '2026-12-20', ['love'])],
    taste(),
    MIAMI,
  );
  it('filters to near you, this week and this month', () => {
    const ids = (f: Parameters<typeof filterShows>[1]) => filterShows(all, f, TODAY).map((r) => r.show.id).sort();
    expect(ids('week')).toEqual(['today', 'week']);
    expect(ids('month')).toEqual(['month', 'today', 'week']);
    expect(ids('all')).toHaveLength(4);
    expect(ids('near')).toEqual([]);
    expect(filterShows(rankShows([show('d', TODAY, ['love'], { place: DENVER })], taste(), DENVER), 'near', TODAY)).toHaveLength(1);
  });

  it('finds shows by artist first, then name or venue, then town', () => {
    const names: Record<string, string> = { love: 'Fred again..', good: 'Echo Twins' };
    const list = [
      show('town', TODAY, ['love'], { location: 'Echo Park, CA' }),
      show('venue', TODAY, ['love'], { venue: 'Echostage' }),
      show('artist', '2026-10-09', ['good']),
      show('none', TODAY, ['love']),
    ];
    expect(searchShows(list, 'echo', (id) => names[id]).map((s) => s.id)).toEqual(['artist', 'venue', 'town']);
    expect(searchShows(list, 'fred', (id) => names[id], 2)).toHaveLength(2);
    expect(searchShows(list, '  ', (id) => names[id])).toEqual([]);
  });

  it('keeps the calendar reach and groups by day', () => {
    const r = rankShows([show('co', TODAY, ['love'], { place: DENVER }), show('fl', TODAY, ['love'], { location: 'Miami, FL', place: MIAMI })], taste(), DENVER);
    expect(showsInReach(r, { kind: 'state', code: 'FL' }, true).map((x) => x.show.id)).toEqual(['fl']);
    expect(showsInReach(r, { kind: 'near', km: 160 }, true).map((x) => x.show.id)).toEqual(['co']);
    expect(showsInReach(r, { kind: 'near', km: 160 }, false)).toHaveLength(2);
    expect(showsInReach(r, { kind: 'all' }, true)).toHaveLength(2);
    expect(showsByDay(r).get(TODAY)).toHaveLength(2);
  });
});
