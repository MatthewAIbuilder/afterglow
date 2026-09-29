/**
 * Connected music: what Afterglow keeps from a music service, in one shape
 * whatever the service. Spotify and Apple Music adapters turn their own
 * responses into these records and nothing else leaves the adapter, so the
 * rest of the app never knows (or cares) which service a signal came from.
 *
 * Plain data only, so a snapshot can be saved, compared and later sent to a
 * server unchanged.
 *
 * PRIVACY. Everything in this file is PRIVATE by default: it describes a
 * person's own music library and never leaves the phone. Nothing here is
 * shown to anyone else. The one path to sharing is `shareableMusicProfile`
 * in `privacy.ts`, which only ever hands out Afterglow artists (never
 * provider ids, counts or artists outside Afterglow's catalogue), and only
 * with the person's explicit consent. See `MUSIC_FIELD_PRIVACY` there.
 */

/** A music service Afterglow can read a library from. New services are added here and in `services.ts`. */
export type MusicProviderId = 'spotify' | 'apple-music';

export const MUSIC_PROVIDERS: readonly MusicProviderId[] = ['spotify', 'apple-music'];

export const PROVIDER_NAME: Record<MusicProviderId, string> = {
  spotify: 'Spotify',
  'apple-music': 'Apple Music',
};

/**
 * Which part of a library a signal came from.
 * - saved: songs saved to your library (Spotify "Liked Songs", Apple Music library songs)
 * - followed: artists you follow or favourite
 * - top: the artists you play most over the last months
 * - recent: artists you've played in the last few weeks
 */
export type MusicSignalSource = 'saved' | 'followed' | 'top' | 'recent';

export const MUSIC_SIGNAL_SOURCES: readonly MusicSignalSource[] = ['saved', 'followed', 'top', 'recent'];

/**
 * One artist in someone's library, as the service described them. Only what
 * the service actually said: an unknown is left undefined, never guessed.
 */
export type MusicArtistSignal = {
  provider: MusicProviderId;
  /** The service's own id for the artist, when it gave one. Never shown or shared. */
  providerArtistId?: string;
  /** The artist's name as the service writes it. */
  name: string;
  /** The name folded for matching (lowercase, no accents or punctuation): how duplicates are found. */
  key: string;
  /** Songs by this artist saved in the library (counted once per song). */
  savedTracks: number;
  /** Different albums those saved songs come from. */
  savedAlbums: number;
  /** You follow or favourite them. Undefined when the service doesn't say. */
  followed?: boolean;
  /** Place among the artists you play most, 1 = most. Undefined when not among them or not reported. */
  topRank?: number;
  /** Played in the last few weeks. Undefined when the service doesn't say. */
  recent?: boolean;
  /** Genre names from the service, lowercase, as given. Empty when none were given. */
  genres: string[];
  /** Which parts of the library mention them. */
  sources: MusicSignalSource[];
};

/**
 * Parts of a library a service couldn't give on this sync (not granted, not
 * offered for this account, or not part of that service), so nobody reads a
 * missing part as "none".
 */
export type MusicLibraryGap = MusicSignalSource;

/** One sync of one service's library, normalised. */
export type MusicLibrarySnapshot = {
  version: 1;
  provider: MusicProviderId;
  /** When the library was read, ISO 8601. */
  syncedAt: string;
  /** One record per artist, most signal first. */
  artists: MusicArtistSignal[];
  /** Saved songs that were read (the service may have more than the sync reads). */
  savedTracksRead: number;
  /** Parts the service didn't give this time. */
  gaps: MusicLibraryGap[];
};

/** Why a sync or a connection didn't work, in words the screens turn into copy. */
export type MusicErrorKind =
  /** Sign-in has expired or access was removed at the service: connect again. */
  | 'expired'
  /** You said no on the service's permission screen. */
  | 'denied'
  /** No connection, or the service didn't answer. */
  | 'network'
  /** The service asked us to slow down. */
  | 'rate-limited'
  /** This version of the app can't connect to the service (not set up, or needs the full app). */
  | 'unavailable'
  | 'unknown';

/** Where one service stands on this phone. Saved without any token: tokens live in the secure store only. */
export type MusicConnection = {
  provider: MusicProviderId;
  /** You connected it and haven't disconnected. False once sign-in has expired. */
  connected: boolean;
  /** Reading the library right now. */
  syncing: boolean;
  /** The last sync or sign-in problem, cleared by the next success. */
  error?: MusicErrorKind;
  /** When it was last attempted, ISO 8601. */
  lastAttemptAt?: string;
  /** The last good sync. Kept through failed syncs; removed only by disconnecting. */
  snapshot?: MusicLibrarySnapshot;
};

/** Every service's state, by provider. A provider with no entry has never been connected (or was disconnected). */
export type MusicState = Partial<Record<MusicProviderId, MusicConnection>>;
