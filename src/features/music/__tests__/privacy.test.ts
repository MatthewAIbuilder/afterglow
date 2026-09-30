import { describe, expect, it } from '@jest/globals';
import { ARTISTS } from '../../../data/mock/artists';
import { importedMusic } from '../imported';
import { combineLibraries } from '../library';
import type { MusicArtistSignal, MusicConnection, MusicLibrarySnapshot } from '../models';
import { MUSIC_FIELD_PRIVACY, NO_MUSIC_SHARING, shareableMusicProfile } from '../privacy';

const artist: Required<MusicArtistSignal> = {
  provider: 'spotify',
  providerArtistId: 'sp-subtronics',
  name: 'Subtronics',
  key: 'subtronics',
  savedTracks: 12,
  savedAlbums: 3,
  followed: true,
  topRank: 2,
  recent: true,
  genres: ['riddim'],
  sources: ['saved', 'followed', 'top', 'recent'],
};
const other: MusicArtistSignal = { ...artist, providerArtistId: 'sp-unknown', name: 'Somebody Private', key: 'somebody private' };
const snapshot: MusicLibrarySnapshot = { version: 1, provider: 'spotify', syncedAt: '2026-09-29T12:00:00Z', artists: [artist, other], savedTracksRead: 24, gaps: [] };
const connection: Required<MusicConnection> = { provider: 'spotify', connected: true, syncing: false, error: 'network', lastAttemptAt: 'x', snapshot };
const imported = importedMusic(combineLibraries([[artist, other]]), ARTISTS);

describe('music privacy', () => {
  it('classifies every field of every record; all library data is private', () => {
    expect(Object.keys(MUSIC_FIELD_PRIVACY.artist).sort()).toEqual(Object.keys(artist).sort());
    expect(Object.keys(MUSIC_FIELD_PRIVACY.snapshot).sort()).toEqual(Object.keys(snapshot).sort());
    expect(Object.keys(MUSIC_FIELD_PRIVACY.connection).sort()).toEqual(Object.keys(connection).sort());
    for (const group of [MUSIC_FIELD_PRIVACY.artist, MUSIC_FIELD_PRIVACY.snapshot, MUSIC_FIELD_PRIVACY.connection]) {
      expect(new Set(Object.values(group))).toEqual(new Set(['private']));
    }
    expect(new Set(Object.values(MUSIC_FIELD_PRIVACY.profile))).toEqual(new Set(['shareable-with-consent']));
  });

  it('shares nothing without consent', () => {
    expect(shareableMusicProfile(imported, ARTISTS)).toEqual({ favoriteArtists: [], topSounds: [] });
    expect(shareableMusicProfile(imported, ARTISTS, NO_MUSIC_SHARING)).toEqual({ favoriteArtists: [], topSounds: [] });
  });

  it('with consent, only Afterglow artists and sounds: never the service’s ids, counts or other artists', () => {
    const shared = shareableMusicProfile(imported, ARTISTS, { favoriteArtists: true, topSounds: true });
    expect(shared.favoriteArtists).toEqual([{ artistId: 'subtronics', name: 'SUBTRONICS' }]);
    expect(shared.topSounds).toEqual(['riddim', 'dubstep']);
    const text = JSON.stringify(shared);
    for (const secret of ['sp-subtronics', 'Somebody Private', 'spotify', '12', 'followed']) expect(text).not.toContain(secret);
  });

  it('each part needs its own consent', () => {
    expect(shareableMusicProfile(imported, ARTISTS, { favoriteArtists: false, topSounds: true }).favoriteArtists).toEqual([]);
    expect(shareableMusicProfile(imported, ARTISTS, { favoriteArtists: true, topSounds: false }).topSounds).toEqual([]);
  });
});
