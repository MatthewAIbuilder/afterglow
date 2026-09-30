import { SPOTIFY_ENDPOINTS, SPOTIFY_SCOPES } from './tokens';

/**
 * The Spotify sign-in round trip, as pure functions: the PKCE pair, the
 * authorize link, and reading what Spotify sends back. The browser sheet
 * itself is in signIn.ts; everything that decides anything is here, so it is
 * tested without a phone or an account.
 *
 * Authorization Code with PKCE (RFC 7636, S256): the app holds only the
 * public client id. A random `state` goes out with the request and must come
 * back unchanged, so a link that didn't start from this sign-in (another app,
 * an old tab, a forged redirect) is refused before any code is exchanged.
 */

/** What the platform supplies: random bytes and SHA-256 (expo-crypto on a phone, Node's crypto in tests). */
export type AuthCrypto = {
  randomBytes(count: number): Uint8Array;
  /** SHA-256 of the text, as standard base64. */
  sha256Base64(text: string): Promise<string>;
};

const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/** A random string from the characters RFC 7636 allows, one random byte per character. */
export function randomToken(crypto: AuthCrypto, length: number): string {
  let out = '';
  while (out.length < length) {
    for (const b of crypto.randomBytes(length * 2)) {
      // 66 characters: only bytes below 198 (3 × 66) are used, so every character is equally likely.
      if (b < 198 && out.length < length) out += UNRESERVED[b % 66];
    }
  }
  return out;
}

export const toBase64Url = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export type Pkce = { verifier: string; challenge: string };

/** A PKCE pair: a 64-character verifier and its S256 challenge. */
export async function makePkce(crypto: AuthCrypto): Promise<Pkce> {
  const verifier = randomToken(crypto, 64);
  return { verifier, challenge: toBase64Url(await crypto.sha256Base64(verifier)) };
}

export type SpotifyAuthRequest = { url: string; state: string; verifier: string; redirectUri: string };

/** Everything one sign-in needs: the link to open, and what must match when Spotify answers. */
export async function spotifyAuthRequest(clientId: string, redirectUri: string, crypto: AuthCrypto): Promise<SpotifyAuthRequest> {
  const { verifier, challenge } = await makePkce(crypto);
  const state = randomToken(crypto, 32);
  const params: Record<string, string> = {
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SPOTIFY_SCOPES.join(' '),
    state,
  };
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return { url: `${SPOTIFY_ENDPOINTS.authorizationEndpoint}?${query}`, state, verifier, redirectUri };
}

export type AuthReturn =
  | { type: 'code'; code: string }
  /** You said no on Spotify's screen. */
  | { type: 'denied' }
  /** The answer wasn't for this sign-in (state missing or different, or another address). Nothing is exchanged. */
  | { type: 'mismatch' }
  | { type: 'error' };

/** Query (and fragment) parameters of a redirect, without trusting its shape. */
function paramsOf(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const q = url.indexOf('?');
  if (q < 0) return out;
  for (const part of url.slice(q + 1).split(/[&#]/)) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const k = eq < 0 ? part : part.slice(0, eq);
    const v = eq < 0 ? '' : part.slice(eq + 1);
    try {
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
      // A malformed escape: leave that parameter out.
    }
  }
  return out;
}

/**
 * Reads the address Spotify sent the browser back to. Only an answer to this
 * very request counts: it must be the redirect address, and carry the state
 * that went out. A denial is only believed when the state matches too.
 */
export function readAuthReturn(url: string, expected: { state: string; redirectUri: string }): AuthReturn {
  const base = url.split(/[?#]/)[0];
  if (base !== expected.redirectUri) return { type: 'mismatch' };
  const p = paramsOf(url);
  if (!p.state || p.state !== expected.state) return { type: 'mismatch' };
  if (p.error) return p.error === 'access_denied' ? { type: 'denied' } : { type: 'error' };
  if (p.code) return { type: 'code', code: p.code };
  return { type: 'error' };
}

/**
 * The redirect address to register with Spotify and send in the request.
 * Either a custom scheme (afterglow://music-auth) or an https universal link
 * (for when Spotify's dashboard won't accept the scheme). Anything else, or
 * a malformed value, falls back to the default.
 */
export function redirectUriFrom(configured: string | undefined, fallback: string): string {
  const v = (configured ?? '').trim();
  if (!v) return fallback;
  if (/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[A-Za-z0-9._~\-/]*)?$/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:\/\/[A-Za-z0-9._~\-/]+$/i.test(v) && !/^(https?|exp|exps):/i.test(v)) return v;
  return fallback;
}

export const isUniversalLink = (redirectUri: string) => redirectUri.startsWith('https://');
