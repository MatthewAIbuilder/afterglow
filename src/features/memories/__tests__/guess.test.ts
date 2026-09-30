import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../../../data/bundled';
import type { Festival } from '../../../data/models';
import { festivalRoute } from '../../plan/route';
import { artistConfidence, festivalConfidence, guessArtists, guessFestivals, nightOf, reasonLine } from '../guess';

/**
 * Guessing who's in a video from when and where it was filmed, the set times
 * and your own plan. Times are the phone's local clock, as on a phone.
 */
const catalog = BUILT_IN.catalog;
const solstice: Festival = { ...catalog.festival('solstice-26')!, startDate: '2026-06-19', endDate: '2026-06-21', location: 'Lakeside Grounds, Orlando, Florida' };
const acl = catalog.festival('acl-26')!;
const edc = catalog.festival('edc-orlando-26')!;
const cyclops = catalog.festival('cyclops-cove-4')!;
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi);
const artists = catalog.artists;
const flat: Record<string, number> = {};

describe('which night a moment belongs to', () => {
  it('a night runs noon to noon: 1 AM Saturday is still Friday night', () => {
    expect(nightOf(solstice, at(2026, 6, 19, 23, 50))).toEqual({ night: 'Friday', minute: 23 * 60 + 50 });
    expect(nightOf(solstice, at(2026, 6, 20, 1, 0))).toEqual({ night: 'Friday', minute: 25 * 60 });
    expect(nightOf(solstice, at(2026, 6, 20, 14, 0))).toEqual({ night: 'Saturday', minute: 14 * 60 });
  });

  it('two-weekend festivals find the night by weekday', () => {
    expect(nightOf(acl, at(2026, 10, 10, 20, 0))?.night).toBe('Saturday'); // weekend 2
    expect(nightOf(acl, at(2026, 10, 6, 20, 0))).toBeUndefined(); // the Tuesday between weekends
  });

  it('outside the festival, or with no day names, there is no night', () => {
    expect(nightOf(solstice, at(2026, 7, 1, 22, 0))).toBeUndefined();
    expect(nightOf(edc, at(2026, 11, 7, 22, 0))).toBeUndefined();
  });
});

describe('guessing the festival', () => {
  it('the date and the city agree: sure', () => {
    const [top] = guessFestivals(catalog.festivals, { when: at(2026, 11, 7, 23, 0), place: { city: 'Orlando', region: 'Florida' } });
    expect(top.festival.id).toBe('edc-orlando-26');
    expect(top.reasons).toEqual(['date', 'city']);
    expect(festivalConfidence(top)).toBe('sure');
  });

  it('the date alone is likely; the date and your plans are sure', () => {
    const [top] = guessFestivals(catalog.festivals, { when: at(2026, 12, 5, 22, 0) });
    expect(top.festival.id).toBe('cyclops-cove-4');
    expect(top.night).toBe('Saturday');
    expect(festivalConfidence(top)).toBe('likely');
    expect(festivalConfidence(guessFestivals(catalog.festivals, { when: at(2026, 12, 5, 22, 0) }, ['cyclops-cove-4'])[0])).toBe('sure');
  });

  it('the same city months away isn’t that festival; the region alone is weak', () => {
    const july = guessFestivals(catalog.festivals, { when: at(2026, 7, 4, 22, 0), place: { city: 'Orlando', region: 'Florida' } });
    expect(july.map((g) => g.festival.id)).not.toContain('edc-orlando-26');
    // Neither location names Florida, so the region alone finds nothing; a location that does is only a weak reason.
    expect(guessFestivals([cyclops, edc], { place: { region: 'Florida' } })).toEqual([]);
    const [weak] = guessFestivals([solstice], { place: { region: 'Florida' } });
    expect(weak.reasons).toEqual(['region']);
    expect(festivalConfidence(weak)).toBe('maybe');
  });

  it('with nothing to go on, festivals you’re going to are still offered', () => {
    const g = guessFestivals(catalog.festivals, {}, ['acl-26']);
    expect(g.map((x) => x.festival.id)).toEqual(['acl-26']);
    expect(festivalConfidence(g[0])).toBe('maybe');
  });

  it('overlapping festivals on New Year’s Eve: the city decides', () => {
    const [top] = guessFestivals(catalog.festivals, { when: at(2026, 12, 31, 23, 30), place: { city: 'San Bernardino' } });
    expect(top.festival.id).toBe('countdown-nye-26');
    const [orl] = guessFestivals(catalog.festivals, { when: at(2026, 12, 31, 23, 30), place: { city: 'Orlando' } });
    expect(orl.festival.id).toBe('eternal-nye-26');
    expect(orl.night).toBe('Dec 31');
  });
});

describe('guessing the artist', () => {
  const route = festivalRoute({ festival: solstice, artists, taste: { illenium: 0.95, subtronics: 0.6 }, informed: { illenium: true, subtronics: true } });

  it('your plan for that minute comes first, and is sure', () => {
    // Friday 00:30: ILLENIUM (Main) and SUBTRONICS (Bass) overlap; the plan has you at ILLENIUM.
    const g = guessArtists({ festival: solstice, night: 'Friday', minute: 24 * 60 + 30, artists, taste: flat, route });
    expect(g[0].artist.id).toBe('illenium');
    expect(g[0].reason).toBe('plan');
    expect(reasonLine(g[0], 'Friday')).toBe('On your plan · Main Stage');
    expect(g[1]).toMatchObject({ reason: 'on-now' });
    expect(g[1].artist.id).toBe('subtronics');
    expect(reasonLine(g[1])).toBe('Bass Tent until 1:30 AM');
    expect(artistConfidence(g)).toBe('sure');
  });

  it('one set at that minute is sure; two without a plan are likely, your match first', () => {
    const one = guessArtists({ festival: solstice, night: 'Sunday', minute: 21 * 60, artists, taste: flat });
    expect(one[0].artist.id).toBe('john-summit');
    expect(artistConfidence(one)).toBe('sure');
    const two = guessArtists({ festival: solstice, night: 'Friday', minute: 22 * 60 + 30, artists, taste: { 'sara-landry': 0.9, 'tape-b': 0.2 } });
    expect(two.slice(0, 2).map((x) => x.artist.id)).toEqual(['sara-landry', 'tape-b']);
    expect(artistConfidence(two)).toBe('likely');
  });

  it('a few minutes after a set ends still points to it', () => {
    const g = guessArtists({ festival: solstice, night: 'Sunday', minute: 22 * 60 + 5, artists, taste: flat });
    expect(g[0]).toMatchObject({ reason: 'close' });
    expect(g[0].artist.id).toBe('john-summit');
    expect(reasonLine(g[0])).toBe('Main Stage · 8:30 PM to 10:00 PM');
  });

  it('before set times: that night’s lineup, stars first, then your match', () => {
    const g = guessArtists({ festival: cyclops, night: 'Friday', artists, taste: flat, pinned: new Set(['subtronics']) });
    const friday = g.filter((x) => x.reason === 'tonight');
    expect(friday.length).toBeGreaterThan(3);
    expect(friday.every((x) => (cyclops.artistDays?.[x.artist.id] ?? ['Friday']).includes('Friday'))).toBe(true);
    // Everyone else is still there to search, after them.
    expect(g.length).toBe(cyclops.lineup.length);
    expect(artistConfidence(g)).toBe('maybe');
  });

  it('with no night, the whole lineup by your match', () => {
    const g = guessArtists({ festival: edc, artists, taste: { 'steve-aoki': 0.9 } });
    expect(g[0].artist.id).toBe('steve-aoki');
    expect(g.every((x) => x.reason === 'lineup')).toBe(true);
  });
});
