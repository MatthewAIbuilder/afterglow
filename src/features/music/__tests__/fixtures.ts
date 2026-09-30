/**
 * Realistic responses from Spotify's Web API and the Apple Music API, trimmed
 * to a handful of items, including the awkward cases real libraries have:
 * local files without ids, removed songs (null), missing genres, collabs,
 * the same song on two pages, and names written differently from Afterglow's
 * catalogue ("Illenium" vs ILLENIUM). No real account or credential is used.
 */
import type { FetchLike } from '../http';

// ---- Spotify ---------------------------------------------------------------

const track = (id: string | null, name: string, album: string, artists: [string | null, string][]) => ({
  added_at: '2026-08-01T20:15:00Z',
  track: {
    id,
    name,
    type: 'track',
    duration_ms: 215000,
    album: { id: album.toLowerCase().replace(/\W+/g, ''), name: album, album_type: 'album', release_date: '2023-05-12' },
    artists: artists.map(([aid, aname]) => ({ id: aid, name: aname, type: 'artist', uri: aid ? `spotify:artist:${aid}` : null })),
  },
});

export const SPOTIFY_SAVED_PAGE_1 = {
  href: 'https://api.spotify.com/v1/me/tracks?offset=0&limit=50',
  limit: 50,
  offset: 0,
  total: 7,
  next: 'https://api.spotify.com/v1/me/tracks?offset=50&limit=50',
  previous: null,
  items: [
    track('t-illenium-1', 'Good Things Fall Apart', 'Ascend', [['sp-illenium', 'Illenium']]),
    track('t-illenium-2', 'Takeaway', 'Ascend', [['sp-illenium', 'Illenium']]),
    track('t-collab', 'Fallen Angel', 'Fallen Angel', [['sp-subtronics', 'Subtronics'], ['sp-excision', 'Excision']]),
    // A local file: no ids anywhere.
    track(null, 'Bootleg Edit', 'Local Files', [[null, 'Tape B']]),
    // A song removed from Spotify comes back as a null track.
    { added_at: '2026-07-01T10:00:00Z', track: null },
  ],
};

export const SPOTIFY_SAVED_PAGE_2 = {
  href: 'https://api.spotify.com/v1/me/tracks?offset=50&limit=50',
  limit: 50,
  offset: 50,
  total: 7,
  next: null,
  previous: 'https://api.spotify.com/v1/me/tracks?offset=0&limit=50',
  items: [
    // The same song again (a page boundary shifted while reading): counted once.
    track('t-illenium-1', 'Good Things Fall Apart', 'Ascend', [['sp-illenium', 'Illenium']]),
    track('t-illenium-3', 'Nightlight', 'Fallen Embers', [['sp-illenium', 'Illenium']]),
    track('t-hozier', 'Too Sweet', 'Unheard', [['sp-hozier', 'Hozier']]),
  ],
};

export const SPOTIFY_FOLLOWING = {
  artists: {
    href: 'https://api.spotify.com/v1/me/following?type=artist&limit=50',
    limit: 50,
    next: null,
    cursors: { after: null },
    total: 2,
    items: [
      { id: 'sp-subtronics', name: 'Subtronics', type: 'artist', genres: ['riddim', 'dubstep'], images: [] },
      { id: 'sp-john-summit', name: 'John Summit', type: 'artist', genres: ['house', 'tech house'], images: [] },
    ],
  },
};

export const SPOTIFY_TOP_MEDIUM = {
  href: 'https://api.spotify.com/v1/me/top/artists?time_range=medium_term&limit=50',
  limit: 50,
  offset: 0,
  total: 4,
  next: null,
  items: [
    { id: 'sp-illenium', name: 'Illenium', type: 'artist', genres: ['melodic bass', 'edm'] },
    { id: 'sp-subtronics', name: 'Subtronics', type: 'artist', genres: ['riddim'] },
    // Not on any Afterglow lineup: counts only through its sound.
    { id: 'sp-seven-lions', name: 'Seven Lions', type: 'artist', genres: ['melodic dubstep', 'future bass'] },
    // Genres left out entirely.
    { id: 'sp-hozier', name: 'Hozier', type: 'artist' },
  ],
};

export const SPOTIFY_TOP_SHORT = {
  href: 'https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=50',
  limit: 50,
  offset: 0,
  total: 2,
  next: null,
  items: [
    { id: 'sp-levity', name: 'LEVITY', type: 'artist', genres: null },
    { id: 'sp-illenium', name: 'Illenium', type: 'artist', genres: ['melodic bass'] },
  ],
};

export const SPOTIFY_TOKEN = {
  access_token: 'fixture-access-1',
  token_type: 'Bearer',
  scope: 'user-library-read user-follow-read user-top-read',
  expires_in: 3600,
  refresh_token: 'fixture-refresh-1',
};

// ---- Apple Music -----------------------------------------------------------

const song = (id: string, name: string, artistName: string, albumName: string, genreNames: string[]) => ({
  id,
  type: 'library-songs',
  href: `/v1/me/library/songs/${id}`,
  attributes: {
    name,
    artistName,
    albumName,
    genreNames,
    trackNumber: 1,
    durationInMillis: 201000,
    playParams: { id, kind: 'song', isLibrary: true, reporting: true, catalogId: `c${id}` },
  },
});

export const APPLE_SONGS_PAGE_1 = {
  next: '/v1/me/library/songs?offset=100',
  meta: { total: 5 },
  data: [
    song('i.1', 'Good Things Fall Apart', 'ILLENIUM', 'ASCEND', ['Dance', 'Music']),
    song('i.2', 'Crashing', 'ILLENIUM', 'ASCEND', ['Dance', 'Music']),
    song('i.3', 'Pulse', 'Sara Landry', 'Pulse - Single', ['Techno', 'Electronic']),
  ],
};

export const APPLE_SONGS_PAGE_2 = {
  meta: { total: 5 },
  data: [
    song('i.4', 'Hollow', 'ILLENIUM', 'Fallen Embers', ['Dance']),
    // A song with no artist name at all: skipped, not a crash.
    { id: 'i.5', type: 'library-songs', attributes: { name: 'Untitled' } },
  ],
};

export const APPLE_LIBRARY_ARTISTS = {
  data: [
    {
      id: 'r.10',
      type: 'library-artists',
      attributes: { name: 'ILLENIUM' },
      relationships: { catalog: { data: [{ id: '1034567', type: 'artists', attributes: { name: 'ILLENIUM', genreNames: ['Dance'] } }] } },
    },
    {
      id: 'r.11',
      type: 'library-artists',
      attributes: { name: 'Sara Landry' },
      relationships: { catalog: { data: [{ id: '1500001', type: 'artists', attributes: { name: 'Sara Landry', genreNames: ['Techno'] } }] } },
    },
    // No catalogue relationship.
    { id: 'r.12', type: 'library-artists', attributes: { name: 'Someone Local' } },
  ],
};

export const APPLE_HEAVY_ROTATION = {
  data: [
    { id: '1600', type: 'albums', attributes: { name: 'Fallen Embers', artistName: 'ILLENIUM', genreNames: ['Dance'] } },
    // Playlists say nothing about one artist.
    { id: 'pl.1', type: 'playlists', attributes: { name: 'Festival Warmup' } },
    { id: 'l.9', type: 'library-albums', attributes: { name: 'Tapeworm', artistName: 'Tape B', genreNames: ['Dubstep'] } },
  ],
};

export const APPLE_RECENT = {
  data: [
    { id: '1700', type: 'songs', attributes: { name: 'Pulse', artistName: 'Sara Landry', genreNames: ['Techno'] } },
    { id: '1701', type: 'songs', attributes: { name: 'Where You Are', artistName: 'John Summit', genreNames: ['House', 'Dance'] } },
  ],
};

// ---- A fake network --------------------------------------------------------

type Answer = { status: number; body?: unknown } | ((init?: Parameters<FetchLike>[1]) => { status: number; body?: unknown });

/**
 * A fetch that answers from a table of URLs (exact match), records every
 * call, and fails loudly on anything unexpected.
 */
export function fakeFetch(routes: Record<string, Answer | Answer[]>) {
  const calls: { url: string; init?: Parameters<FetchLike>[1] }[] = [];
  const used: Record<string, number> = {};
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const route = routes[url];
    if (!route) throw new Error(`Unexpected request: ${url}`);
    const i = used[url] ?? 0;
    used[url] = i + 1;
    const pick = Array.isArray(route) ? route[Math.min(i, route.length - 1)] : route;
    const r = typeof pick === 'function' ? pick(init) : pick;
    return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.body };
  };
  return { fetch: fn, calls };
}

export const SPOTIFY_ROUTES = {
  'https://api.spotify.com/v1/me/tracks?limit=50': { status: 200, body: SPOTIFY_SAVED_PAGE_1 },
  'https://api.spotify.com/v1/me/tracks?offset=50&limit=50': { status: 200, body: SPOTIFY_SAVED_PAGE_2 },
  'https://api.spotify.com/v1/me/following?type=artist&limit=50': { status: 200, body: SPOTIFY_FOLLOWING },
  'https://api.spotify.com/v1/me/top/artists?time_range=medium_term&limit=50': { status: 200, body: SPOTIFY_TOP_MEDIUM },
  'https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=50': { status: 200, body: SPOTIFY_TOP_SHORT },
};

export const APPLE_ROUTES = {
  'https://api.music.apple.com/v1/me/library/songs?limit=100': { status: 200, body: APPLE_SONGS_PAGE_1 },
  'https://api.music.apple.com/v1/me/library/songs?offset=100': { status: 200, body: APPLE_SONGS_PAGE_2 },
  'https://api.music.apple.com/v1/me/library/artists?limit=100&include=catalog': { status: 200, body: APPLE_LIBRARY_ARTISTS },
  'https://api.music.apple.com/v1/me/history/heavy-rotation?limit=10': { status: 200, body: APPLE_HEAVY_ROTATION },
  'https://api.music.apple.com/v1/me/recent/played/tracks?limit=30': { status: 200, body: APPLE_RECENT },
};

/** An in-memory secure store. */
export function memorySecrets() {
  const items = new Map<string, string>();
  return {
    items,
    get: async (k: string) => items.get(k) ?? null,
    set: async (k: string, v: string) => void items.set(k, v),
    remove: async (k: string) => void items.delete(k),
  };
}
