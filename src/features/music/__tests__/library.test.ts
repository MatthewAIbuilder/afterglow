import { describe, expect, it } from '@jest/globals';
import { ARTISTS } from '../../../data/mock/artists';
import { normalizeAppleMusic } from '../apple/normalize';
import { genreSound, genresToSound } from '../genres';
import { importedMusic, NO_IMPORTED_MUSIC } from '../imported';
import { combineLibraries, librarySignals } from '../library';
import type { MusicArtistSignal, MusicLibrarySnapshot, MusicState } from '../models';
import { normalizeSpotify } from '../spotify/normalize';
import { artistStrength } from '../strength';
import {
  APPLE_HEAVY_ROTATION,
  APPLE_LIBRARY_ARTISTS,
  APPLE_RECENT,
  APPLE_SONGS_PAGE_1,
  APPLE_SONGS_PAGE_2,
  SPOTIFY_FOLLOWING,
  SPOTIFY_SAVED_PAGE_1,
  SPOTIFY_SAVED_PAGE_2,
  SPOTIFY_TOP_MEDIUM,
  SPOTIFY_TOP_SHORT,
} from './fixtures';

const AT = new Date('2026-09-29T12:00:00Z');
const spotify = normalizeSpotify(
  {
    saved: [...SPOTIFY_SAVED_PAGE_1.items, ...SPOTIFY_SAVED_PAGE_2.items],
    followed: SPOTIFY_FOLLOWING.artists.items,
    top: SPOTIFY_TOP_MEDIUM.items,
    recent: SPOTIFY_TOP_SHORT.items,
    gaps: [],
  },
  AT,
);
const apple = normalizeAppleMusic(
  {
    songs: [...APPLE_SONGS_PAGE_1.data, ...APPLE_SONGS_PAGE_2.data],
    artists: APPLE_LIBRARY_ARTISTS.data,
    heavyRotation: APPLE_HEAVY_ROTATION.data,
    recent: APPLE_RECENT.data,
    gaps: [],
  },
  AT,
);
const state = (...snaps: MusicLibrarySnapshot[]): MusicState =>
  Object.fromEntries(snaps.map((s) => [s.provider, { provider: s.provider, connected: true, syncing: false, snapshot: s }]));

const signal = (over: Partial<MusicArtistSignal>): MusicArtistSignal => ({
  provider: 'spotify',
  name: 'X',
  key: 'x',
  savedTracks: 0,
  savedAlbums: 0,
  genres: [],
  sources: [],
  ...over,
});

describe('library strength', () => {
  it('one saved song is a weak signal; following, many songs and plays add up to a strong one', () => {
    expect(artistStrength(signal({ savedTracks: 1 }))).toBeCloseTo(0.15);
    expect(artistStrength(signal({ savedTracks: 3 }))).toBeCloseTo(0.3);
    expect(artistStrength(signal({ savedTracks: 40 }))).toBeCloseTo(0.45);
    expect(artistStrength(signal({ followed: true }))).toBeCloseTo(0.5);
    expect(artistStrength(signal({ followed: true, savedTracks: 20, topRank: 1, recent: true }))).toBe(1);
    expect(artistStrength(signal({ topRank: 1 }))).toBeGreaterThan(artistStrength(signal({ topRank: 40 })));
    expect(artistStrength(signal({}))).toBe(0);
  });
});

describe('combining libraries', () => {
  it('an artist in both services is one record, from both, with the strongest evidence of each', () => {
    const lib = combineLibraries(librarySignals(state(spotify, apple)));
    const illenium = lib.filter((a) => a.key === 'illenium');
    expect(illenium).toHaveLength(1);
    expect(illenium[0].providers).toEqual(['spotify', 'apple-music']);
    // 3 saved on each service: the larger count, never the sum (it may be the same songs).
    expect(illenium[0].savedTracks).toBe(3);
    expect(illenium[0].topRank).toBe(1);
    expect(illenium[0].genres).toEqual(expect.arrayContaining(['melodic bass', 'dance']));
    expect(new Set(lib.map((a) => a.key)).size).toBe(lib.length);
  });

  it('a record claiming another service never counts for it', () => {
    const forged: MusicLibrarySnapshot = { ...apple, artists: [...apple.artists, signal({ provider: 'spotify', name: 'Forged', key: 'forged', followed: true })] };
    const lib = combineLibraries(librarySignals(state(forged)));
    expect(lib.find((a) => a.key === 'forged')).toBeUndefined();
    expect(lib.every((a) => a.providers.every((p) => p === 'apple-music'))).toBe(true);
  });

  it('no service connected: nothing at all', () => {
    expect(combineLibraries(librarySignals({}))).toEqual([]);
    expect(importedMusic([], ARTISTS)).toBe(NO_IMPORTED_MUSIC);
  });
});

describe('matching the library to Afterglow artists', () => {
  const lib = combineLibraries(librarySignals(state(spotify, apple)));
  const imported = importedMusic(lib, ARTISTS);

  it('finds catalogue artists by folded name, one Afterglow artist each', () => {
    // "Illenium" / "ILLENIUM", "Subtronics", "LEVITY", "Tape B", "Excision", "Sara Landry", "John Summit".
    expect(Object.keys(imported.artists).sort()).toEqual(['excision', 'illenium', 'john-summit', 'levity', 'sara-landry', 'subtronics', 'tape-b']);
    expect(imported.matched).toBe(7);
    expect(imported.from.illenium).toEqual(['spotify', 'apple-music']);
    expect(imported.from.subtronics).toEqual(['spotify']);
    expect(imported.artists.subtronics).toBeGreaterThan(imported.artists.excision);
  });

  it('two library spellings of one catalogue artist count once, the stronger', () => {
    const twice = combineLibraries([[signal({ name: 'Tape B', key: 'tape b', savedTracks: 1 }), signal({ name: 'TAPE-B', key: 'tape b', followed: true })]]);
    expect(twice).toHaveLength(1);
    const spaced = importedMusic(
      [
        { ...twice[0], key: 'tape b', strength: 0.2 },
        { ...twice[0], key: 'tape b', strength: 0.6 },
      ],
      ARTISTS,
    );
    expect(spaced.artists).toEqual({ 'tape-b': 0.6 });
  });

  it('artists Afterglow doesn’t have count only through a clear sound, never as artists', () => {
    // Seven Lions: melodic dubstep / future bass. Hozier: no genres at all. Someone Local: no signal.
    expect(imported.sounds).toEqual([{ sound: { 'melodic-bass': 1 }, strength: expect.any(Number) }]);
    expect(imported.libraryArtists).toBe(lib.length);
  });
});

describe('genres as sounds', () => {
  it('maps clear genres, ignores broad ones', () => {
    expect(genreSound('melodic dubstep')).toEqual({ 'melodic-bass': 1 });
    expect(genreSound('Riddim')).toEqual({ riddim: 1 });
    expect(genreSound('dubstep')).toEqual({ dubstep: 1 });
    expect(genreSound('tech house')).toEqual({ house: 1 });
    expect(genreSound('Hip-Hop/Rap')).toEqual({ 'hip-hop': 1 });
    expect(genreSound('alternative rock')).toEqual({ rock: 1 });
    expect(genreSound('alternative')).toEqual({ indie: 1 });
    expect(genreSound('edm')).toBeUndefined();
    expect(genreSound('electronic')).toBeUndefined();
    expect(genreSound('Dance')).toBeUndefined();
    expect(genreSound('')).toBeUndefined();
  });

  it('turns an artist’s genres into one profile, strongest sound 1', () => {
    expect(genresToSound(['riddim', 'dubstep', 'edm'])).toEqual({ riddim: 1, dubstep: 1 });
    expect(genresToSound(['indie pop', 'pop'])).toEqual({ indie: 0.67, pop: 1 });
    expect(genresToSound(['dance', 'music'])).toEqual({});
  });
});
