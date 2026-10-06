import { describe, expect, it } from '@jest/globals';
import { cleanArtistName, extraArtist, forgetExtraArtists, newArtistId, noteArtist } from '../../../data/extraArtists';
import { hqRequests, isNewPastFestival } from '../hqRequests';

describe('asking HQ about something new on a video', () => {
  it('asks for a badge for a festival Afterglow has nothing for, never for a known one or another year of one on Afterglow', () => {
    expect(isNewPastFestival({ name: 'Sunset Sessions' })).toBe(true);
    expect(isNewPastFestival({ name: 'EDC Orlando' })).toBe(false);
    expect(isNewPastFestival({ name: 'Nightfall', seriesId: 'nightfall-27' })).toBe(false);
    const [r] = hqRequests({ past: { name: 'Sunset Sessions', year: 2023, city: 'Orlando' } }, []);
    expect(r).toMatchObject({ key: 'festival:sunset sessions', topic: 'festival' });
    // On a festival on Afterglow, the past one doesn't count.
    expect(hqRequests({ festivalId: 'x', past: { name: 'Sunset Sessions', year: 2023 } }, [])).toEqual([]);
  });

  it('asks to add a new artist, and asks about each thing once', () => {
    const r = hqRequests({ artistId: 'rezz', artistName: 'REZZ', past: { name: 'Sunset Sessions', year: 2023 } }, []);
    expect(r.map((x) => x.key)).toEqual(['festival:sunset sessions', 'artist:rezz']);
    expect(hqRequests({ artistId: 'rezz', artistName: 'REZZ' }, ['artist:rezz'])).toEqual([]);
    // An artist on Afterglow (no typed name) is nothing new.
    expect(hqRequests({ artistId: 'subtronics' }, [])).toEqual([]);
  });
});

describe('artists named on videos', () => {
  it('get the id the catalogue would give them, and are found by it with the name typed', () => {
    forgetExtraArtists();
    expect(newArtistId('REZZ')).toBe('rezz');
    expect(newArtistId('Seven Lions')).toBe('seven-lions');
    expect(cleanArtistName('  REZZ  ')).toBe('REZZ');
    expect(cleanArtistName('!!!')).toBeUndefined();
    expect(cleanArtistName('x'.repeat(80))).toHaveLength(60);
    expect(extraArtist('rezz')).toBeUndefined();
    noteArtist('rezz', 'REZZ');
    noteArtist('rezz', 'Rezz again');
    expect(extraArtist('rezz')).toEqual({ id: 'rezz', name: 'REZZ', sound: {} });
    noteArtist('Bad Id!', 'X');
    expect(extraArtist('Bad Id!')).toBeUndefined();
  });
});
