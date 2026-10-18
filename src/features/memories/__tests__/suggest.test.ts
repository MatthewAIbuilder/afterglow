import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { offeredArtists, sameNight, showsThatNight, suggestFestival, type ArtistGuess, type FestivalGuess } from '../guess';
import { sentMoment } from '../sent';

const f = (id: string) => ({ id, name: id }) as Festival;
const g = (id: string, reasons: FestivalGuess['reasons']): FestivalGuess => ({ festival: f(id), reasons, score: 0 });

describe('one festival suggestion', () => {
  it('the one you’re going to that night wins', () => {
    expect(suggestFestival([g('far', ['date']), g('mine', ['date', 'going']), g('here', ['date', 'city'])])?.festival.id).toBe('mine');
  });

  it('otherwise only when one festival has both the date and the place', () => {
    expect(suggestFestival([g('far', ['date']), g('here', ['date', 'city'])])?.festival.id).toBe('here');
    expect(suggestFestival([g('a', ['date', 'city']), g('b', ['date', 'region'])])).toBeUndefined();
    // The date alone, anywhere in the world (Day Trip Norcal while you're in Florida): nothing.
    expect(suggestFestival([g('far', ['date'])])).toBeUndefined();
    // Going, but not that night: nothing.
    expect(suggestFestival([g('later', ['going'])])).toBeUndefined();
  });

  it('with no place on the video, the only festival that night', () => {
    expect(suggestFestival([g('only', ['date'])], false)?.festival.id).toBe('only');
    expect(suggestFestival([g('a', ['date']), g('b', ['date'])], false)).toBeUndefined();
  });

  it('that night’s festivals for the list under the search', () => {
    expect(sameNight([g('a', ['date']), g('b', ['city']), g('c', ['date', 'going'])]).map((x) => x.festival.id)).toEqual(['a', 'c']);
  });

  it('shows that night in the town you filmed in, never everywhere', () => {
    const shows = [
      { id: 's1', date: '2026-12-05', location: 'Boca Raton, FL' },
      { id: 's2', date: '2026-12-05', location: 'Denver, CO' },
      { id: 's3', date: '2026-12-06', location: 'Boca Raton, FL' },
    ];
    const when = new Date(2026, 11, 5, 23, 0);
    expect(showsThatNight(shows, { when, place: { city: 'Boca Raton' } }).map((s) => s.id)).toEqual(['s1']);
    // After midnight still counts as the night before.
    expect(showsThatNight(shows, { when: new Date(2026, 11, 6, 2, 0), place: { city: 'Boca Raton' } }).map((s) => s.id)).toEqual(['s1']);
    expect(showsThatNight(shows, { when })).toEqual([]);
  });
});

describe('the artists offered', () => {
  const a = (id: string, reason: ArtistGuess['reason']): ArtistGuess => ({ artist: { id, name: id } as ArtistGuess['artist'], reason, score: 0 });
  it('everyone on at that minute once set times are out; before, your likeliest few', () => {
    const on = [a('plan', 'plan'), a('x', 'on-now'), a('y', 'on-now'), a('z', 'close'), a('later', 'tonight')];
    expect(offeredArtists(on).map((x) => x.artist.id)).toEqual(['plan', 'x', 'y', 'z']);
    const before = [a('p', 'tonight'), a('q', 'tonight'), a('r', 'tonight'), a('s', 'tonight')];
    expect(offeredArtists(before).map((x) => x.artist.id)).toEqual(['p', 'q', 'r']);
  });
});

describe('the moment after sending', () => {
  it('says where it went, with a word about looking after yourself, differing between sends', () => {
    expect(sentMoment({ discover: true, crew: false }, 0).title).toBe('Shared to Discover');
    expect(sentMoment({ discover: false, crew: true }, 0).title).toBe('Sent to your crew');
    expect(sentMoment({ discover: true, crew: true }, 0).title).toBe('Sent to Discover and your crew');
    const lines = new Set([0, 1, 2, 3, 4].map((i) => sentMoment({ discover: true, crew: false }, i).line));
    expect(lines.size).toBe(5);
    expect(new Set([0, 1, 2].map((i) => sentMoment({ discover: true, crew: false }, i).look)).size).toBe(3);
  });
});
