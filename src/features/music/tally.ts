import { normalize } from '../festivals/search';
import type { MusicArtistSignal, MusicProviderId, MusicSignalSource } from './models';
import { artistStrength } from './strength';

/**
 * Builds one service's artist list from the pieces of a library (saved songs,
 * followed artists, top artists, recent plays), one artist per record however
 * often they come up. Pure. Adapters feed it; it never sees raw responses.
 *
 * The same artist is recognised by the service's id first, then by name
 * (folded: case, accents and punctuation ignored), so "SUBTRONICS" and
 * "Subtronics" are one artist and a song counted twice is counted once.
 */

/** The name folded for matching across sections, services and the catalogue. */
export const musicKey = (name: string) => normalize(name);

/** Keep at most this many genre names per artist. */
const MAX_GENRES = 8;

export type TallyArtist = { id?: string | null; name?: string | null };

type Entry = {
  signal: MusicArtistSignal;
  tracks: Set<string>;
  albums: Set<string>;
};

export function artistTally(provider: MusicProviderId) {
  const byKey = new Map<string, Entry>();
  const byId = new Map<string, Entry>();

  const entry = (artist: TallyArtist): Entry | undefined => {
    const name = typeof artist.name === 'string' ? artist.name.trim() : '';
    const id = typeof artist.id === 'string' && artist.id ? artist.id : undefined;
    const key = musicKey(name);
    if (!key) return undefined;
    const found = (id && byId.get(id)) || byKey.get(key);
    if (found) {
      if (id && !found.signal.providerArtistId) found.signal.providerArtistId = id;
      if (id) byId.set(id, found);
      return found;
    }
    const e: Entry = {
      signal: { provider, providerArtistId: id, name, key, savedTracks: 0, savedAlbums: 0, genres: [], sources: [] },
      tracks: new Set(),
      albums: new Set(),
    };
    byKey.set(key, e);
    if (id) byId.set(id, e);
    return e;
  };

  const mark = (e: Entry, source: MusicSignalSource) => {
    if (!e.signal.sources.includes(source)) e.signal.sources.push(source);
  };

  const addGenres = (e: Entry, genres: readonly unknown[] | null | undefined) => {
    if (!Array.isArray(genres)) return;
    for (const g of genres) {
      if (typeof g !== 'string') continue;
      const name = g.trim().toLowerCase();
      if (name && !e.signal.genres.includes(name) && e.signal.genres.length < MAX_GENRES) e.signal.genres.push(name);
    }
  };

  return {
    /** A saved song. `trackId` makes the same song count once; albums are counted by id. */
    saved(artist: TallyArtist, trackId: string, albumId?: string, genres?: readonly unknown[]) {
      const e = entry(artist);
      if (!e || !trackId) return;
      mark(e, 'saved');
      addGenres(e, genres);
      e.tracks.add(trackId);
      if (albumId) e.albums.add(albumId);
    },
    /** An artist you follow or favourite. */
    followed(artist: TallyArtist, genres?: readonly unknown[]) {
      const e = entry(artist);
      if (!e) return;
      mark(e, 'followed');
      e.signal.followed = true;
      addGenres(e, genres);
    },
    /** An artist among those you play most; rank 1 is the most. The best rank wins. */
    top(artist: TallyArtist, rank: number, genres?: readonly unknown[]) {
      const e = entry(artist);
      if (!e || !(rank >= 1)) return;
      mark(e, 'top');
      e.signal.topRank = Math.min(e.signal.topRank ?? Infinity, Math.round(rank));
      addGenres(e, genres);
    },
    /** An artist played in the last few weeks. */
    recent(artist: TallyArtist, genres?: readonly unknown[]) {
      const e = entry(artist);
      if (!e) return;
      mark(e, 'recent');
      e.signal.recent = true;
      addGenres(e, genres);
    },
    /** Genres (and the service's id) for an artist already in the list, from a section that only describes artists. */
    describe(artist: TallyArtist, genres?: readonly unknown[]) {
      const name = typeof artist.name === 'string' ? musicKey(artist.name) : '';
      const e = (artist.id && byId.get(artist.id)) || (name && byKey.get(name));
      if (!e) return;
      if (artist.id && !e.signal.providerArtistId) {
        e.signal.providerArtistId = artist.id;
        byId.set(artist.id, e);
      }
      addGenres(e, genres);
    },
    /** One record per artist, most signal first (then by name, so the order is stable). */
    finish(): MusicArtistSignal[] {
      return [...byKey.values()]
        .map((e) => ({ ...e.signal, savedTracks: e.tracks.size, savedAlbums: e.albums.size, sources: [...e.signal.sources] }))
        .sort((a, b) => artistStrength(b) - artistStrength(a) || a.key.localeCompare(b.key));
    },
  };
}
