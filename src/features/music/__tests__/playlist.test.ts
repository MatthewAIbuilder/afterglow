import { describe, expect, it } from '@jest/globals';
import { makeApplePlaylist } from '../apple/playlist';
import { planPlaylist, sameArtist } from '../playlist';
import { makeSpotifyPlaylist } from '../spotify/playlist';

const req = planPlaylist('EDC Orlando 2026', ['John Summit', 'Odd Mob', 'Nobody Known', 'John Summit']);

describe('plan to playlist', () => {
  it('asks for each artist once, by name', () => {
    expect(req).toEqual({ name: 'EDC Orlando 2026 · my plan', description: 'My plan for EDC Orlando 2026, made with Afterglow.', artists: ['John Summit', 'Odd Mob', 'Nobody Known'], perArtist: 2 });
    expect(sameArtist('Above & Beyond', 'above and beyond')).toBe(true);
    expect(sameArtist('Odd Mob', 'Odd Mobb')).toBe(false);
  });

  it('Apple Music: finds each artist in your storefront, takes their top songs, makes one playlist', async () => {
    const posts: { path: string; body: unknown }[] = [];
    const get = async (path: string): Promise<unknown> => {
      if (path === '/v1/me/storefront') return { data: [{ id: 'us' }] };
      if (path.includes('/search?')) {
        const term = decodeURIComponent(path.split('term=')[1]);
        return term === 'Nobody Known' ? { results: {} } : { results: { artists: { data: [{ id: `a-${term}`, attributes: { name: term } }] } } };
      }
      if (path.includes('/view/top-songs')) return { data: [{ id: `${path}-1` }, { id: `${path}-2` }, { id: `${path}-3` }] };
      throw new Error(path);
    };
    const r = await makeApplePlaylist(get, async (path, body) => void posts.push({ path, body }), req);
    expect(r).toEqual({ added: 4, missing: ['Nobody Known'] });
    expect(posts).toHaveLength(1);
    expect(posts[0].path).toBe('/v1/me/library/playlists');
    expect((posts[0].body as { relationships: { tracks: { data: unknown[] } } }).relationships.tracks.data).toHaveLength(4);
  });

  it('Spotify: a private playlist with each artist’s top tracks in your country', async () => {
    const sent: { url: string; method: string; body: unknown }[] = [];
    const get = async (url: string): Promise<unknown> => {
      if (url.endsWith('/me')) return { id: 'maya', country: 'US' };
      if (url.includes('/search?')) {
        const q = decodeURIComponent(url.split('q=')[1]);
        return { artists: { items: q === 'Nobody Known' ? [{ id: 'x', name: 'Somebody Else' }] : [{ id: `id-${q.replace(' ', '')}`, name: q }] } };
      }
      if (url.includes('/top-tracks?market=US')) return { tracks: [{ uri: `spotify:track:${url.length}a` }, { uri: `spotify:track:${url.length}b` }, { uri: 'spotify:track:c' }] };
      throw new Error(url);
    };
    const send = async (url: string, method: string, body: unknown): Promise<unknown> => {
      sent.push({ url, method, body });
      return url.endsWith('/users/maya/playlists') ? { id: 'pl1', external_urls: { spotify: 'https://open.spotify.com/playlist/pl1' } } : {};
    };
    const r = await makeSpotifyPlaylist(get, send, req);
    expect(r).toEqual({ added: 4, missing: ['Nobody Known'], url: 'https://open.spotify.com/playlist/pl1' });
    expect(sent.map((x) => x.url.replace('https://api.spotify.com/v1', ''))).toEqual(['/users/maya/playlists', '/playlists/pl1/tracks']);
    expect(sent[0].body).toEqual({ name: req.name, description: req.description, public: false });
  });
});
