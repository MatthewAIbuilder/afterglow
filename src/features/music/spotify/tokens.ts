import { field, HttpStatusError, requestJson, type FetchLike } from '../http';
import { MusicServiceError } from '../service';

/**
 * Spotify sign-in tokens: exchanging the sign-in code and refreshing an
 * expired access token. Authorization Code with PKCE, so the app holds only
 * the public client id, never a client secret.
 *
 * A session is stored only in the secure store (see secrets.ts), never in
 * AsyncStorage, and never logged.
 */
export const SPOTIFY_ENDPOINTS = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
} as const;

/**
 * Only what the import reads, nothing more:
 * - user-library-read: your Liked Songs (to count saved songs per artist)
 * - user-follow-read: artists you follow
 * - user-top-read: the artists you play most (about six months, and the last four weeks)
 * No playlists, no playback, no email or account details, and nothing that writes.
 */
export const SPOTIFY_SCOPES = ['user-library-read', 'user-follow-read', 'user-top-read', 'playlist-modify-private'] as const;

export type SpotifySession = {
  accessToken: string;
  refreshToken?: string;
  /** When the access token stops working, ms since epoch. */
  expiresAt: number;
  scope?: string;
};

/** Refresh this long before the access token runs out. */
const EARLY_MS = 60_000;

export const needsRefresh = (s: SpotifySession, now: number) => s.expiresAt - EARLY_MS <= now;

function parseSession(json: unknown, now: number, previousRefresh?: string): SpotifySession {
  const accessToken = field(json, 'access_token');
  const expiresIn = Number(field(json, 'expires_in'));
  const refresh = field(json, 'refresh_token');
  const scope = field(json, 'scope');
  if (typeof accessToken !== 'string' || !accessToken) throw new MusicServiceError('unknown', 'Spotify sign-in answer had no access token');
  return {
    accessToken,
    // Spotify may or may not rotate the refresh token; keep the old one when it doesn't send a new one.
    refreshToken: typeof refresh === 'string' && refresh ? refresh : previousRefresh,
    expiresAt: now + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000,
    scope: typeof scope === 'string' ? scope : undefined,
  };
}

const form = (params: Record<string, string>) =>
  Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };

export async function exchangeSpotifyCode(
  input: { code: string; codeVerifier: string; redirectUri: string; clientId: string },
  fetchFn: FetchLike,
  now: number,
): Promise<SpotifySession> {
  const json = await requestJson(
    fetchFn,
    SPOTIFY_ENDPOINTS.tokenEndpoint,
    {
      method: 'POST',
      headers: FORM,
      body: form({
        grant_type: 'authorization_code',
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: input.clientId,
        code_verifier: input.codeVerifier,
      }),
    },
    'Spotify sign-in',
  );
  return parseSession(json, now);
}

/** A fresh access token. A refused refresh (revoked, or too old) means signing in again: kind `expired`. */
export async function refreshSpotifySession(session: SpotifySession, clientId: string, fetchFn: FetchLike, now: number): Promise<SpotifySession> {
  if (!session.refreshToken) throw new MusicServiceError('expired', 'Spotify session has no refresh token');
  try {
    const json = await requestJson(
      fetchFn,
      SPOTIFY_ENDPOINTS.tokenEndpoint,
      { method: 'POST', headers: FORM, body: form({ grant_type: 'refresh_token', refresh_token: session.refreshToken, client_id: clientId }) },
      'Spotify refresh',
    );
    return parseSession(json, now, session.refreshToken);
  } catch (e) {
    // 400 invalid_grant: the refresh token was revoked or has expired.
    if (e instanceof HttpStatusError && (e.status === 400 || e.status === 401)) throw new MusicServiceError('expired', 'Spotify refused the refresh');
    throw e;
  }
}
