import { field, list } from '../http';
import { type PlaylistRequest, type PlaylistResult, sameArtist } from '../playlist';

/**
 * Your plan as an Apple Music playlist in your library: your storefront,
 * each artist found in the catalogue by name (only an exact match counts),
 * their top songs, then one new playlist.
 */
export async function makeApplePlaylist(get: (path: string) => Promise<unknown>, post: (path: string, body: unknown) => Promise<unknown>, req: PlaylistRequest): Promise<PlaylistResult> {
  const sf = field(list(field(await get('/v1/me/storefront'), 'data'))[0], 'id');
  const storefront = typeof sf === 'string' && /^[a-z]{2}$/.test(sf) ? sf : 'us';
  const songs: string[] = [];
  const missing: string[] = [];
  for (const name of req.artists) {
    try {
      const found = list(field(field(field(await get(`/v1/catalog/${storefront}/search?types=artists&limit=3&term=${encodeURIComponent(name)}`), 'results'), 'artists'), 'data'));
      const artist = found.find((a) => sameArtist(String(field(field(a, 'attributes'), 'name') ?? ''), name));
      const id = field(artist, 'id');
      if (typeof id !== 'string') {
        missing.push(name);
        continue;
      }
      const top = list(field(await get(`/v1/catalog/${storefront}/artists/${encodeURIComponent(id)}/view/top-songs?limit=${req.perArtist}`), 'data'));
      const ids = top.map((s) => field(s, 'id')).filter((x): x is string => typeof x === 'string').slice(0, req.perArtist);
      if (ids.length) songs.push(...ids);
      else missing.push(name);
    } catch {
      missing.push(name);
    }
  }
  if (!songs.length) return { added: 0, missing };
  await post('/v1/me/library/playlists', {
    attributes: { name: req.name, description: req.description },
    relationships: { tracks: { data: songs.map((id) => ({ id, type: 'songs' })) } },
  });
  return { added: songs.length, missing };
}
