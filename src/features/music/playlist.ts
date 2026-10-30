import { t } from '../../i18n';

/**
 * Plan to playlist: your festival plan as a playlist in Apple Music or
 * Spotify, to warm up on the way there. Pure: what to ask for. Each service
 * finds every artist by name, takes their most popular songs, and makes a
 * private playlist in your library (`apple/playlist.ts`, `spotify/playlist.ts`).
 */
export type PlaylistRequest = { name: string; description: string; artists: string[]; perArtist: number };
export type PlaylistResult = { added: number; missing: string[]; url?: string };

/** Most artists in one playlist, and songs each. */
export const PLAYLIST_ARTISTS = 25;
export const SONGS_EACH = 2;

export function planPlaylist(festivalName: string, artistNames: readonly string[]): PlaylistRequest {
  const artists = [...new Set(artistNames.map((n) => n.trim()).filter(Boolean))].slice(0, PLAYLIST_ARTISTS);
  return {
    name: t('{festival} · my plan', { festival: festivalName }).slice(0, 100),
    description: t('My plan for {festival}, made with Afterglow.', { festival: festivalName }).slice(0, 300),
    artists,
    perArtist: SONGS_EACH,
  };
}

/** The name a service search should match: case, spaces and "&"/"and" aside. */
export const sameArtist = (a: string, b: string) => {
  const f = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
  return f(a) === f(b);
};
