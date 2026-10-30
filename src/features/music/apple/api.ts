import { field, HttpStatusError, list, requestJson, type FetchLike } from '../http';
import type { MusicLibraryGap } from '../models';
import { MusicServiceError } from '../service';
import type { AppleLibraryArtist, AppleLibrarySong, AppleMusicLibrary, AppleRecentItem } from './normalize';

/**
 * Reading an Apple Music library through the Apple Music API. Every request
 * carries the developer token (who the app is) and the Music User Token (the
 * person's permission, from MusicKit on the phone).
 *
 * - 401: the developer token was refused. That's a setup problem, not the
 *   person's: kind `unavailable`.
 * - 403: the person's Music User Token no longer works (permission removed,
 *   subscription ended): kind `expired`, connect again.
 * - A part of the library that isn't offered (404) becomes a gap.
 * - Only links on api.music.apple.com are followed.
 */
export const APPLE_MUSIC_API = 'https://api.music.apple.com';

/** How much of a library one sync reads (Apple pages hold up to 100). */
export const APPLE_LIMITS = { songs: 1000, artists: 500 } as const;

export function appleMusicClient(opts: { fetch: FetchLike; developerToken: string; userToken: string }) {
  return async function get(pathOrUrl: string): Promise<unknown> {
    const url = pathOrUrl.startsWith('/') ? `${APPLE_MUSIC_API}${pathOrUrl}` : pathOrUrl;
    if (!url.startsWith(`${APPLE_MUSIC_API}/`)) throw new MusicServiceError('unknown', 'Refused a link outside the Apple Music API');
    try {
      return await requestJson(
        opts.fetch,
        url,
        { headers: { Authorization: `Bearer ${opts.developerToken}`, 'Music-User-Token': opts.userToken } },
        'Apple Music',
      );
    } catch (e) {
      if (e instanceof HttpStatusError && e.status === 401) {
        throw new MusicServiceError('unavailable', 'Apple Music refused the developer token');
      }
      if (e instanceof HttpStatusError && e.status === 403) {
        throw new MusicServiceError('expired', 'Apple Music no longer accepts the permission');
      }
      throw e;
    }
  };
}

export async function readAppleMusicLibrary(get: (path: string) => Promise<unknown>, limits = APPLE_LIMITS): Promise<AppleMusicLibrary> {
  const gaps: MusicLibraryGap[] = [];
  const section = async <T>(source: MusicLibraryGap, read: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await read();
    } catch (e) {
      // 404 only: a 403 here means the permission is gone, which fails the whole sync.
      if (!(e instanceof HttpStatusError && e.status === 404)) throw e;
      gaps.push(source);
      return [];
    }
  };
  const pages = async (first: string, max: number) => {
    const items: unknown[] = [];
    let next: unknown = first;
    while (typeof next === 'string' && items.length < max) {
      const page = await get(next);
      items.push(...list(field(page, 'data')));
      next = field(page, 'next');
    }
    return items.slice(0, max);
  };

  const songs = await section('saved', () => pages('/v1/me/library/songs?limit=100', limits.songs));
  const artists = await section('saved', () => pages('/v1/me/library/artists?limit=100&include=catalog', limits.artists));
  const heavyRotation = await section('top', async () => list(field(await get('/v1/me/history/heavy-rotation?limit=10'), 'data')));
  const recent = await section('recent', async () => list(field(await get('/v1/me/recent/played/tracks?limit=30'), 'data')));
  return {
    songs: songs as AppleLibrarySong[],
    artists: artists as AppleLibraryArtist[],
    heavyRotation: heavyRotation as AppleRecentItem[],
    recent: recent as AppleRecentItem[],
    gaps,
  };
}

/** A change in the library (making a playlist), with the same two tokens. */
export function appleMusicPost(opts: { fetch: FetchLike; developerToken: string; userToken: string }) {
  return async function post(path: string, body: unknown): Promise<unknown> {
    if (!path.startsWith('/v1/me/')) throw new MusicServiceError('unknown', 'Refused a change outside your library');
    try {
      return await requestJson(
        opts.fetch,
        `${APPLE_MUSIC_API}${path}`,
        { method: 'POST', headers: { Authorization: `Bearer ${opts.developerToken}`, 'Music-User-Token': opts.userToken, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        'Apple Music',
      );
    } catch (e) {
      if (e instanceof HttpStatusError && e.status === 401) throw new MusicServiceError('unavailable', 'Apple Music refused the developer token');
      if (e instanceof HttpStatusError && e.status === 403) throw new MusicServiceError('expired', 'Apple Music no longer accepts the permission');
      throw e;
    }
  };
}
