import { field, HttpStatusError, list, notOffered, requestJson, type FetchLike } from '../http';
import type { MusicLibraryGap } from '../models';
import { MusicServiceError } from '../service';
import type { SpotifyArtist, SpotifyLibrary, SpotifySavedTrack } from './normalize';
import { needsRefresh, refreshSpotifySession, type SpotifySession } from './tokens';

/**
 * Reading a Spotify library through the Web API. `fetch` and the session
 * store are passed in, so this runs against fixtures in tests.
 *
 * - The access token is refreshed shortly before it runs out, and once more
 *   if Spotify says it's no longer valid (401). A refused refresh clears the
 *   stored session and reports `expired`: the person connects again.
 * - A part of the library Spotify doesn't offer this account or app (403,
 *   404) becomes a gap, not a failure. If every part is refused, the sync
 *   fails as `denied`.
 * - Only links on api.spotify.com are followed, so the token is never sent
 *   anywhere else.
 */
export const SPOTIFY_API = 'https://api.spotify.com/v1';

/** How much of a library one sync reads (Spotify pages hold 50). */
export const SPOTIFY_LIMITS = { savedTracks: 1000, followed: 500 } as const;

export type SpotifySessionStore = {
  load(): Promise<SpotifySession | null>;
  save(session: SpotifySession): Promise<void>;
  clear(): Promise<void>;
};

export function spotifyClient(opts: { fetch: FetchLike; sessions: SpotifySessionStore; clientId: string; now: () => number }) {
  let session: SpotifySession | null = null;

  const signedOut = async (message: string) => {
    session = null;
    await opts.sessions.clear().catch(() => {});
    return new MusicServiceError('expired', message);
  };

  async function token(force = false): Promise<string> {
    session ??= await opts.sessions.load();
    if (!session) throw await signedOut('Not signed in to Spotify');
    if (force || needsRefresh(session, opts.now())) {
      try {
        session = await refreshSpotifySession(session, opts.clientId, opts.fetch, opts.now());
      } catch (e) {
        if (e instanceof MusicServiceError && e.kind === 'expired') throw await signedOut(e.message);
        throw e;
      }
      await opts.sessions.save(session);
    }
    return session.accessToken;
  }

  async function get(url: string): Promise<unknown> {
    if (!url.startsWith(`${SPOTIFY_API}/`)) throw new MusicServiceError('unknown', 'Refused a link outside the Spotify API');
    const call = async (t: string) => requestJson(opts.fetch, url, { headers: { Authorization: `Bearer ${t}` } }, 'Spotify');
    try {
      return await call(await token());
    } catch (e) {
      if (!(e instanceof HttpStatusError) || e.status !== 401) throw e;
    }
    try {
      return await call(await token(true));
    } catch (e) {
      if (e instanceof HttpStatusError && e.status === 401) throw await signedOut('Spotify no longer accepts the sign-in');
      throw e;
    }
  }

  /** A change on your account (making a playlist): the same sign-in and refresh as `get`. */
  async function send(url: string, method: string, body: unknown): Promise<unknown> {
    if (!url.startsWith(`${SPOTIFY_API}/`)) throw new MusicServiceError('unknown', 'Refused a link outside the Spotify API');
    const call = async (t: string) => requestJson(opts.fetch, url, { method, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 'Spotify');
    try {
      return await call(await token());
    } catch (e) {
      if (!(e instanceof HttpStatusError) || e.status !== 401) throw e;
    }
    return call(await token(true));
  }

  return { get, send };
}

export async function readSpotifyLibrary(get: (url: string) => Promise<unknown>, limits = SPOTIFY_LIMITS): Promise<SpotifyLibrary> {
  const gaps: MusicLibraryGap[] = [];
  const section = async <T>(source: MusicLibraryGap, read: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await read();
    } catch (e) {
      if (!notOffered(e)) throw e;
      gaps.push(source);
      return [];
    }
  };
  const pages = async (first: string, max: number, at: (json: unknown) => unknown) => {
    const items: unknown[] = [];
    let url: unknown = first;
    while (typeof url === 'string' && items.length < max) {
      const page = at(await get(url));
      items.push(...list(field(page, 'items')));
      url = field(page, 'next');
    }
    return items.slice(0, max);
  };

  const saved = await section('saved', () => pages(`${SPOTIFY_API}/me/tracks?limit=50`, limits.savedTracks, (j) => j));
  const followed = await section('followed', () =>
    pages(`${SPOTIFY_API}/me/following?type=artist&limit=50`, limits.followed, (j) => field(j, 'artists')),
  );
  const top = await section('top', async () => list(field(await get(`${SPOTIFY_API}/me/top/artists?time_range=medium_term&limit=50`), 'items')));
  const recent = await section('recent', async () =>
    list(field(await get(`${SPOTIFY_API}/me/top/artists?time_range=short_term&limit=50`), 'items')),
  );
  if (gaps.length === 4) throw new MusicServiceError('denied', 'Spotify refused every part of the library');
  return {
    saved: saved as SpotifySavedTrack[],
    followed: followed as SpotifyArtist[],
    top: top as SpotifyArtist[],
    recent: recent as SpotifyArtist[],
    gaps,
  };
}
