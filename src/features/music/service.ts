import type { PlaylistRequest, PlaylistResult } from './playlist';
import type { MusicErrorKind, MusicLibrarySnapshot, MusicProviderId } from './models';

/**
 * The boundary every music service adapter implements. The app talks to
 * services only through this: it asks to connect, to read the library as a
 * normalised snapshot, and to disconnect. Tokens, endpoints and each
 * service's quirks stay inside the adapter.
 */
export type MusicAvailability =
  | { ok: true }
  /**
   * not-set-up: this build has no developer credentials for the service.
   * needs-full-app: the service needs native code that isn't in this build (Apple Music in Expo Go).
   * not-on-this-device: the platform can't do it at all (Apple Music on Android, anything on web).
   */
  | { ok: false; reason: 'not-set-up' | 'needs-full-app' | 'not-on-this-device' };

export type ConnectResult = { ok: true } | { ok: false; reason: 'cancelled' | MusicErrorKind };

export interface MusicService {
  readonly provider: MusicProviderId;
  /** Whether this build can connect at all. Checked before offering Connect. */
  availability(): MusicAvailability;
  /** Ask the person to sign in and grant access. Stores its own credentials securely. */
  connect(): Promise<ConnectResult>;
  /** Read the library, normalised. Throws a MusicServiceError when it can't. */
  fetchLibrary(now: Date): Promise<MusicLibrarySnapshot>;
  /** Forget this service's credentials on the phone (and revoke them where the service allows). */
  disconnect(): Promise<void>;
  /** Make a private playlist in your library from these artists' top songs (where the service can). */
  makePlaylist?(req: PlaylistRequest): Promise<PlaylistResult>;
}

/**
 * A problem reading a service, by kind. The message is for developers and
 * never contains a token, a code or a response body.
 */
export class MusicServiceError extends Error {
  readonly kind: MusicErrorKind;
  constructor(kind: MusicErrorKind, message: string = kind) {
    super(message);
    this.name = 'MusicServiceError';
    this.kind = kind;
  }
}

export const errorKind = (e: unknown): MusicErrorKind => (e instanceof MusicServiceError ? e.kind : 'unknown');

/** An HTTP status from a music API as an error kind. */
export function statusKind(status: number): MusicErrorKind {
  if (status === 401 || status === 403) return 'expired';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'network';
  return 'unknown';
}
