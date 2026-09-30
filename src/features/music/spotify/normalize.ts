import type { MusicLibraryGap, MusicLibrarySnapshot } from '../models';
import { artistTally } from '../tally';

/**
 * Spotify Web API responses, only the fields Afterglow reads. Everything is
 * optional or nullable because Spotify leaves things out (local files have
 * no ids, removed songs come back as null, `genres` may be missing), and a
 * missing field must never break a sync.
 */
export type SpotifyArtistRef = { id?: string | null; name?: string | null };
export type SpotifyArtist = SpotifyArtistRef & { genres?: string[] | null };
export type SpotifySavedTrack = {
  added_at?: string;
  track?: {
    id?: string | null;
    name?: string | null;
    album?: { id?: string | null; name?: string | null } | null;
    artists?: SpotifyArtistRef[] | null;
  } | null;
};

/** What the adapter read, section by section. A section it couldn't read is listed in `gaps` instead. */
export type SpotifyLibrary = {
  /** GET /me/tracks: your Liked Songs. */
  saved: SpotifySavedTrack[];
  /** GET /me/following?type=artist. */
  followed: SpotifyArtist[];
  /** GET /me/top/artists, medium term (about six months), best first. */
  top: SpotifyArtist[];
  /** GET /me/top/artists, short term (about four weeks). */
  recent: SpotifyArtist[];
  gaps: MusicLibraryGap[];
};

/**
 * Spotify's library in Afterglow's shape. Pure. Only names, Spotify's artist
 * ids, counts and genres are kept: song titles, album names, playlists and
 * the account itself never leave this function.
 */
export function normalizeSpotify(lib: SpotifyLibrary, syncedAt: Date): MusicLibrarySnapshot {
  const tally = artistTally('spotify');
  let savedTracksRead = 0;
  for (const item of lib.saved ?? []) {
    const t = item?.track;
    if (!t || !Array.isArray(t.artists)) continue;
    // Local files have no id; the title (with the artists) still tells two songs apart.
    const trackId = t.id || `${t.name ?? ''}|${t.artists.map((a) => a?.name ?? '').join(',')}`;
    savedTracksRead++;
    for (const a of t.artists) if (a) tally.saved(a, trackId, t.album?.id ?? t.album?.name ?? undefined);
  }
  for (const a of lib.followed ?? []) if (a) tally.followed(a, a.genres ?? undefined);
  (lib.top ?? []).forEach((a, i) => a && tally.top(a, i + 1, a.genres ?? undefined));
  for (const a of lib.recent ?? []) if (a) tally.recent(a, a.genres ?? undefined);
  return {
    version: 1,
    provider: 'spotify',
    syncedAt: syncedAt.toISOString(),
    artists: tally.finish(),
    savedTracksRead,
    gaps: [...new Set(lib.gaps ?? [])],
  };
}
