import { field, list } from '../http';
import { type PlaylistRequest, type PlaylistResult, sameArtist } from '../playlist';
import { SPOTIFY_API } from './api';

/**
 * Your plan as a private Spotify playlist: who you are (and your country, for
 * the songs on offer there), each artist found by name (exact match only),
 * their top tracks, then one new playlist with them.
 */
export async function makeSpotifyPlaylist(get: (url: string) => Promise<unknown>, send: (url: string, method: string, body: unknown) => Promise<unknown>, req: PlaylistRequest): Promise<PlaylistResult> {
  const me = await get(`${SPOTIFY_API}/me`);
  const user = field(me, 'id');
  const country = field(me, 'country');
  const market = typeof country === 'string' && /^[A-Z]{2}$/.test(country) ? country : 'US';
  if (typeof user !== 'string') throw new Error('No Spotify user');
  const uris: string[] = [];
  const missing: string[] = [];
  for (const name of req.artists) {
    try {
      const found = list(field(field(await get(`${SPOTIFY_API}/search?type=artist&limit=3&q=${encodeURIComponent(name)}`), 'artists'), 'items'));
      const artist = found.find((a) => sameArtist(String(field(a, 'name') ?? ''), name));
      const id = field(artist, 'id');
      if (typeof id !== 'string') {
        missing.push(name);
        continue;
      }
      const top = list(field(await get(`${SPOTIFY_API}/artists/${encodeURIComponent(id)}/top-tracks?market=${market}`), 'tracks'));
      const these = top.map((x) => field(x, 'uri')).filter((x): x is string => typeof x === 'string' && x.startsWith('spotify:track:')).slice(0, req.perArtist);
      if (these.length) uris.push(...these);
      else missing.push(name);
    } catch {
      missing.push(name);
    }
  }
  if (!uris.length) return { added: 0, missing };
  const made = await send(`${SPOTIFY_API}/users/${encodeURIComponent(user)}/playlists`, 'POST', { name: req.name, description: req.description, public: false });
  const playlist = field(made, 'id');
  if (typeof playlist !== 'string') throw new Error('Spotify made no playlist');
  for (let i = 0; i < uris.length; i += 100) await send(`${SPOTIFY_API}/playlists/${encodeURIComponent(playlist)}/tracks`, 'POST', { uris: uris.slice(i, i + 100) });
  const url = field(field(made, 'external_urls'), 'spotify');
  return { added: uris.length, missing, ...(typeof url === 'string' && url.startsWith('https://open.spotify.com/') ? { url } : {}) };
}
