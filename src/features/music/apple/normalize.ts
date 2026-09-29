import type { MusicLibraryGap, MusicLibrarySnapshot } from '../models';
import { artistTally } from '../tally';

/**
 * Apple Music API responses, only the fields Afterglow reads. Library items
 * carry the artist only as a name (`artistName`), so artists are matched by
 * name; catalogue ids and genres come along when Apple includes them.
 */
export type AppleResource<A> = { id?: string | null; type?: string | null; attributes?: A | null };

/** GET /v1/me/library/songs */
export type AppleLibrarySong = AppleResource<{
  name?: string | null;
  artistName?: string | null;
  albumName?: string | null;
  genreNames?: string[] | null;
  playParams?: { catalogId?: string | null } | null;
}>;

/** GET /v1/me/library/artists?include=catalog */
export type AppleLibraryArtist = AppleResource<{ name?: string | null }> & {
  relationships?: {
    catalog?: { data?: AppleResource<{ name?: string | null; genreNames?: string[] | null }>[] | null } | null;
  } | null;
};

/** GET /v1/me/recent/played/tracks and GET /v1/me/history/heavy-rotation (albums, songs; playlists are skipped). */
export type AppleRecentItem = AppleResource<{ name?: string | null; artistName?: string | null; genreNames?: string[] | null }>;

/** What the adapter read, section by section. */
export type AppleMusicLibrary = {
  songs: AppleLibrarySong[];
  artists: AppleLibraryArtist[];
  /** Heavy rotation: what you've played most lately, most first. */
  heavyRotation: AppleRecentItem[];
  /** Recently played tracks. */
  recent: AppleRecentItem[];
  gaps: MusicLibraryGap[];
};

/**
 * Apple Music's library in Afterglow's shape. Pure. Only artist names,
 * Apple's catalogue artist ids, counts and genres are kept.
 *
 * Apple's API has no list of favourite or followed artists, so `followed`
 * stays unknown (undefined) and `followed` is always listed as a gap: a
 * missing favourite is never read as "not a favourite".
 */
export function normalizeAppleMusic(lib: AppleMusicLibrary, syncedAt: Date): MusicLibrarySnapshot {
  const tally = artistTally('apple-music');
  let savedTracksRead = 0;
  for (const song of lib.songs ?? []) {
    const a = song?.attributes;
    if (!a?.artistName) continue;
    const trackId = song.id || `${a.name ?? ''}|${a.artistName}`;
    savedTracksRead++;
    tally.saved({ name: a.artistName }, trackId, a.albumName ?? undefined, a.genreNames ?? undefined);
  }
  // Library artists add Apple's catalogue id and genres to artists already there from their songs.
  for (const artist of lib.artists ?? []) {
    const catalog = artist?.relationships?.catalog?.data?.[0];
    const name = artist?.attributes?.name ?? catalog?.attributes?.name;
    tally.describe({ id: catalog?.id ?? undefined, name }, catalog?.attributes?.genreNames ?? undefined);
  }
  // Heavy rotation lists albums and songs you play most: the order is the rank.
  let rank = 0;
  for (const item of lib.heavyRotation ?? []) {
    const a = item?.attributes;
    if (!a?.artistName || item.type === 'playlists' || item.type === 'library-playlists') continue;
    tally.top({ name: a.artistName }, ++rank, a.genreNames ?? undefined);
  }
  for (const item of lib.recent ?? []) {
    const a = item?.attributes;
    if (a?.artistName) tally.recent({ name: a.artistName }, a.genreNames ?? undefined);
  }
  return {
    version: 1,
    provider: 'apple-music',
    syncedAt: syncedAt.toISOString(),
    artists: tally.finish(),
    savedTracksRead,
    gaps: [...new Set<MusicLibraryGap>(['followed', ...(lib.gaps ?? [])])],
  };
}
