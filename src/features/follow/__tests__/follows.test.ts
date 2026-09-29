import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival } from '../../../data/models';
import { cleanFollows, follow, followingLine, followNotices, newsFor, nextFestival, unfollow } from '../follows';

const artist = (id: string): Artist => ({ id, name: id.toUpperCase(), sound: {} });
const fest = (id: string, lineup: string[], extra: Partial<Festival> = {}): Festival => ({
  id,
  name: id.toUpperCase(),
  dates: 'Dec 4 to 6',
  location: '',
  lineup,
  days: ['Friday'],
  stages: [{ id: 'main', name: 'Main Stage' }],
  ...extra,
});
const today = new Date(2026, 8, 29, 12);
const artists = [artist('a'), artist('b')];

describe('following artists', () => {
  it('lists what there is to know: each festival still to come, and the set time there', () => {
    const festivals = [
      fest('past', ['a'], { startDate: '2026-01-01', endDate: '2026-01-02' }),
      fest('undated', ['a']),
      fest('timed', ['a'], {
        startDate: '2026-11-01',
        endDate: '2026-11-02',
        sets: [{ artistId: 'a', day: 'Friday', stageId: 'main', start: '23:40', end: '01:00' }],
      }),
      fest('other', ['b']),
    ];
    expect(newsFor('a', festivals, today).map((n) => n.key)).toEqual([
      'plays:undated',
      'plays:timed',
      'set:timed:Friday:23:40:main',
    ]);
  });

  it('rings only for news that comes after you follow', () => {
    const before = [fest('x', ['a'])];
    const follows = follow({}, 'a', before, today);
    expect(followNotices(follows, artists, before, today)).toEqual([]);

    // Later, they join another lineup and set times come out where they already played.
    const after = [
      fest('x', ['a'], { sets: [{ artistId: 'a', day: 'Friday', stageId: 'main', start: '22:00', end: '23:00' }] }),
      fest('y', ['a'], { startDate: '2026-10-10', endDate: '2026-10-11', dates: 'Oct 10 and 11' }),
    ];
    expect(followNotices(follows, artists, after, today).map((n) => [n.title, n.body, n.artistId])).toEqual([
      ['A joins Y', 'Playing Oct 10 and 11.', 'a'],
      ['Set time for A at X', 'Friday 10:00 PM, Main Stage', 'a'],
    ]);
  });

  it('follows and unfollows, keeping the same object when nothing changes', () => {
    const one = follow({}, 'a', [], today);
    expect(one).toEqual({ a: [] });
    expect(follow(one, 'a', [fest('x', ['a'])], today)).toBe(one);
    expect(unfollow(one, 'a')).toEqual({});
    expect(unfollow(one, 'b')).toBe(one);
  });

  it('reads back only well-formed follows', () => {
    expect(cleanFollows({ a: ['plays:x', 3], b: 'nope', c: [] })).toEqual({ a: ['plays:x'], c: [] });
    expect(cleanFollows(['a'])).toEqual({});
    expect(cleanFollows(null)).toEqual({});
  });

  it('finds where to catch someone next: the soonest dated festival, then undated ones', () => {
    const festivals = [
      fest('undated', ['a']),
      fest('later', ['a'], { startDate: '2026-12-01', endDate: '2026-12-02' }),
      fest('sooner', ['a'], { startDate: '2026-10-20', endDate: '2026-10-21' }),
      fest('over', ['a'], { startDate: '2026-02-01', endDate: '2026-02-02' }),
    ];
    expect(nextFestival('a', festivals, today)?.id).toBe('sooner');
    expect(nextFestival('a', [fest('undated', ['a'])], today)?.id).toBe('undated');
    expect(nextFestival('b', festivals, today)).toBeUndefined();
  });

  it('says who you follow on a lineup in a few words', () => {
    const f = fest('x', ['a', 'b', 'c']);
    const name = (id: string) => id.toUpperCase();
    expect(followingLine(f, [], name)).toBeUndefined();
    expect(followingLine(f, ['b'], name)).toBe('B, who you follow');
    expect(followingLine(f, ['b', 'a'], name)).toBe('A and B, who you follow');
    expect(followingLine(f, ['a', 'b', 'c'], name)).toBe('A and 2 more you follow');
  });
});
