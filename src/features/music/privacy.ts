import { SOUND_TAGS, type Artist, type SoundTag } from '../../data/models';
import type { MusicArtistSignal, MusicConnection, MusicLibrarySnapshot } from './models';

/**
 * What of your connected music could ever be shown to anyone else. Pure.
 *
 * PRIVATE (never leaves the phone, never shown to others, never in a share):
 * - everything a service returned: provider ids, names of artists Afterglow
 *   doesn't have, saved-song and album counts, follows, top ranks, recent
 *   plays, genres, sync times, gaps
 * - which services you connected and whether a sync failed
 * - credentials, which aren't in these records at all (secure store only)
 *
 * POTENTIALLY SHAREABLE (only when you choose to, through a future profile):
 * - favourite artists, and only as Afterglow artists (their Afterglow id and
 *   name), never as the service's record
 * - your top sounds, as Afterglow sound names
 *
 * Future profile features (follows, social activity) must go through
 * `shareableMusicProfile` and nothing else. It returns nothing at all unless
 * consent is given for that part.
 */
export type MusicPrivacy = 'private' | 'shareable-with-consent';

/** Every field of the music records, and whether it could ever be shared. Kept complete by a test. */
export const MUSIC_FIELD_PRIVACY: {
  artist: Record<keyof MusicArtistSignal, 'private'>;
  snapshot: Record<keyof MusicLibrarySnapshot, 'private'>;
  connection: Record<keyof MusicConnection, 'private'>;
  profile: Record<keyof ShareableMusicProfile, 'shareable-with-consent'>;
} = {
  artist: {
    provider: 'private',
    providerArtistId: 'private',
    name: 'private',
    key: 'private',
    savedTracks: 'private',
    savedAlbums: 'private',
    followed: 'private',
    topRank: 'private',
    recent: 'private',
    genres: 'private',
    sources: 'private',
  },
  snapshot: { version: 'private', provider: 'private', syncedAt: 'private', artists: 'private', savedTracksRead: 'private', gaps: 'private' },
  connection: { provider: 'private', connected: 'private', syncing: 'private', error: 'private', lastAttemptAt: 'private', snapshot: 'private' },
  profile: { favoriteArtists: 'shareable-with-consent', topSounds: 'shareable-with-consent' },
};

/** What you've agreed to show on a profile. Nothing by default. */
export type MusicShareConsent = { favoriteArtists: boolean; topSounds: boolean };
export const NO_MUSIC_SHARING: MusicShareConsent = { favoriteArtists: false, topSounds: false };

export type ShareableMusicProfile = {
  /** Afterglow artists only, strongest first. */
  favoriteArtists: { artistId: string; name: string }[];
  topSounds: SoundTag[];
};

/** How many favourite artists a profile could show. */
export const SHAREABLE_FAVORITES = 10;

/**
 * The shareable view of your connected music. Takes Afterglow ids and
 * strengths only (from `importedMusic`), so a service's own record can't
 * reach it by construction.
 */
export function shareableMusicProfile(
  imported: { artists: Record<string, number> },
  catalogue: Artist[],
  consent: MusicShareConsent = NO_MUSIC_SHARING,
): ShareableMusicProfile {
  const byId = new Map(catalogue.map((a) => [a.id, a]));
  const ranked = Object.entries(imported.artists)
    .filter(([id, s]) => byId.has(id) && s > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const favoriteArtists = consent.favoriteArtists
    ? ranked.slice(0, SHAREABLE_FAVORITES).map(([id]) => ({ artistId: id, name: byId.get(id)!.name }))
    : [];
  let topSounds: SoundTag[] = [];
  if (consent.topSounds) {
    const pull: Partial<Record<SoundTag, number>> = {};
    for (const [id, s] of ranked) {
      for (const [tag, w] of Object.entries(byId.get(id)!.sound) as [SoundTag, number][]) pull[tag] = (pull[tag] ?? 0) + s * w;
    }
    topSounds = SOUND_TAGS.filter((t) => (pull[t] ?? 0) > 0)
      .sort((a, b) => (pull[b] ?? 0) - (pull[a] ?? 0))
      .slice(0, 3);
  }
  return { favoriteArtists, topSounds };
}
