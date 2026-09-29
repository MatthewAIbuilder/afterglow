import type { FetchLike } from '../http';
import { SECRET_KEY, type SecretStore } from '../secrets';
import { errorKind, type MusicService } from '../service';
import { readSpotifyLibrary, spotifyClient, type SpotifySessionStore } from './api';
import { normalizeSpotify } from './normalize';
import type { SpotifySignIn } from './signIn';
import { exchangeSpotifyCode, type SpotifySession } from './tokens';

/**
 * The Spotify adapter: sign-in, reading the library, and forgetting the
 * sign-in. The only place that knows Spotify exists. Its session lives in
 * the secure store under one key; nothing else is kept.
 */
export function spotifyService(opts: {
  clientId: string;
  secrets: SecretStore;
  fetch: FetchLike;
  signIn: SpotifySignIn;
  /** False on platforms without a secure store (web). */
  secureStorage: boolean;
  /** True in Expo Go, whose sign-in return address Spotify can't accept: a development build is needed. */
  needsOwnApp?: boolean;
  now?: () => number;
}): MusicService {
  const now = opts.now ?? Date.now;
  const sessions: SpotifySessionStore = {
    async load() {
      const raw = await opts.secrets.get(SECRET_KEY.spotify);
      if (!raw) return null;
      try {
        const s = JSON.parse(raw) as SpotifySession;
        return typeof s?.accessToken === 'string' ? s : null;
      } catch {
        return null;
      }
    },
    save: (s) => opts.secrets.set(SECRET_KEY.spotify, JSON.stringify(s)),
    clear: () => opts.secrets.remove(SECRET_KEY.spotify),
  };

  return {
    provider: 'spotify',
    availability() {
      if (!opts.secureStorage) return { ok: false, reason: 'not-on-this-device' };
      if (!opts.clientId) return { ok: false, reason: 'not-set-up' };
      if (opts.needsOwnApp) return { ok: false, reason: 'needs-full-app' };
      return { ok: true };
    },
    async connect() {
      if (!this.availability().ok) return { ok: false, reason: 'unavailable' };
      try {
        const r = await opts.signIn(opts.clientId);
        if (r.type === 'cancelled') return { ok: false, reason: 'cancelled' };
        if (r.type === 'denied') return { ok: false, reason: 'denied' };
        if (r.type === 'error') return { ok: false, reason: 'unknown' };
        const session = await exchangeSpotifyCode({ ...r, clientId: opts.clientId }, opts.fetch, now());
        await sessions.save(session);
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: errorKind(e) };
      }
    },
    async fetchLibrary(at) {
      const client = spotifyClient({ fetch: opts.fetch, sessions, clientId: opts.clientId, now });
      return normalizeSpotify(await readSpotifyLibrary(client.get), at);
    },
    async disconnect() {
      // Spotify has no way for an app to revoke its own access: the sign-in is
      // forgotten here, and access can be removed at spotify.com/account/apps.
      await sessions.clear();
    },
  };
}
