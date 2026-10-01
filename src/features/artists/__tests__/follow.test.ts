import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival } from '../../../data/models';
import { artistsCount, cleanFollowed, FOLLOW_MAX, followedShows, followSuggestions, moreLine, withFollow } from '../follow';

const artist = (id: string): Artist => ({ id, name: id.toUpperCase(), sound: {} });
const fest = (id: string, startDate: string | undefined, lineup: string[], endDate = startDate): Festival => ({
  id,
  name: `Fest ${id}`,
  dates: '',
  location: '',
  lineup,
  days: [],
  stages: [],
  ...(startDate ? { startDate, endDate } : {}),
});
const today = new Date(2026, 9, 1);

describe('following artists', () => {
  it('keeps a clean list, newest first', () => {
    expect(cleanFollowed(['a', 'a', 3, '', 'b'])).toEqual(['a', 'b']);
    expect(cleanFollowed('nope')).toEqual([]);
    expect(cleanFollowed(Array.from({ length: FOLLOW_MAX + 5 }, (_, i) => `x${i}`))).toHaveLength(FOLLOW_MAX);
    expect(withFollow(['a', 'b'], 'c', true)).toEqual(['c', 'a', 'b']);
    expect(withFollow(['a', 'b'], 'b', true)).toEqual(['b', 'a']);
    expect(withFollow(['a', 'b'], 'a', false)).toEqual(['b']);
  });

  it('lists where they play next: a festival you are going to first for that artist, soonest overall, then nothing yet', () => {
    const festivals = [
      fest('past', '2026-06-01', ['a', 'b']),
      fest('dec', '2026-12-04', ['a', 'c']),
      fest('nov', '2026-11-07', ['a']),
      fest('undated', undefined, ['d']),
    ];
    const artists = new Map(['a', 'b', 'c', 'd'].map((id) => [id, artist(id)]));
    const { upcoming, later } = followedShows(['b', 'a', 'c', 'd', 'gone'], {
      artist: (id) => artists.get(id),
      festivalsOf: (id) => festivals.filter((f) => f.lineup.includes(id)),
      going: ['dec'],
      today,
    });
    expect(upcoming.map((s) => [s.artist.id, s.next.festival.id, s.next.going, s.more])).toEqual([
      ['a', 'dec', true, 1],
      ['c', 'dec', true, 0],
      ['d', 'undated', false, 0],
    ]);
    expect(later.map((a) => a.id)).toEqual(['b']);
  });

  it('suggests artists you would love who play somewhere and you do not follow yet', () => {
    const all = ['a', 'b', 'c', 'd'].map(artist);
    const s = followSuggestions(all, {
      followed: ['a'],
      loves: (id) => id !== 'd',
      taste: { a: 0.9, b: 0.8, c: 0.95 },
      plays: (id) => id !== 'b',
    });
    expect(s.map((a) => a.id)).toEqual(['c']);
  });

  it('says counts plainly', () => {
    expect(artistsCount(1)).toBe('1 artist');
    expect(artistsCount(3)).toBe('3 artists');
    expect(moreLine(0)).toBe('');
    expect(moreLine(1)).toBe('+1 more festival');
    expect(moreLine(2)).toBe('+2 more festivals');
  });
});
