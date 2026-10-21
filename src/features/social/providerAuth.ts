/**
 * Sign in with Apple and with Google, the parts that can be tested: the
 * one-time code (nonce) and Google's sign-in address and answer. Pure.
 *
 * The nonce: a random code kept on the phone, with only its SHA-256 sent to
 * Apple or Google, who write it into the token they hand back. Firebase checks
 * the token against the code itself, so a token caught on its way back to the
 * app is no use to anyone else.
 *
 * Google, in the app: its sign-in page opens in the system's secure browser
 * sheet and answers to a small page on the website (public/google-auth.html),
 * which hands the answer straight back to the app (afterglow://google-auth).
 * Only Google's web client ID is needed, so nothing about Google is built into
 * the app. On the website, Firebase's own Google window is used instead.
 */

export type SignInProvider = 'apple' | 'google';

/** What Apple or Google handed back, for Firebase. */
export type ProviderToken = {
  provider: SignInProvider;
  idToken: string;
  rawNonce: string;
  /** Apple's one-time code, to let go of the account's Apple sign-in when it's deleted. */
  authorizationCode?: string;
};

/** Signing in through Apple or Google: a token from the phone, or Firebase's own window on the website. */
export type ProviderProof = ProviderToken | { provider: SignInProvider; popup: true };

export const isPopup = (p: ProviderProof): p is { provider: SignInProvider; popup: true } => 'popup' in p;

export type NonceCrypto = {
  randomBytes(count: number): Uint8Array;
  /** SHA-256, as lowercase hex. */
  sha256Hex(text: string): Promise<string>;
};

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** `length` random letters and digits (from bytes below 248, so each is equally likely). */
export function randomCode(crypto: NonceCrypto, length: number): string {
  let out = '';
  while (out.length < length) {
    for (const b of crypto.randomBytes(length * 2)) {
      if (b < 248 && out.length < length) out += CHARS[b % CHARS.length];
    }
  }
  return out;
}

/** A fresh nonce: the code kept on the phone and the hash that's sent. */
export async function makeNonce(crypto: NonceCrypto): Promise<{ raw: string; hashed: string }> {
  const raw = randomCode(crypto, 32);
  return { raw, hashed: await crypto.sha256Hex(raw) };
}

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
/** Where the app hears Google's answer, passed on by the website's page. */
export const GOOGLE_APP_RETURN = 'afterglow://google-auth';
/** The website page Google answers to: registered with the web client in Google Cloud exactly like this. */
export const googleRedirectUri = (webUrl: string) => `${webUrl.replace(/\/+$/, '')}/google-auth`;

/** Google's sign-in page, asking for an ID token for this nonce, with a choice of account. */
export function googleAuthUrl(o: { clientId: string; redirectUri: string; state: string; hashedNonce: string }): string {
  const q = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce: o.hashedNonce,
    state: o.state,
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${q.toString()}`;
}

export type GoogleReturn = { type: 'token'; idToken: string } | { type: 'denied' } | { type: 'error' };

/** Google's answer, as the website's page passed it on (after ? or #). The state must be the one sent. */
export function readGoogleReturn(url: string, state: string): GoogleReturn {
  const at = url.search(/[?#]/);
  if (at < 0) return { type: 'error' };
  const q = new URLSearchParams(url.slice(at + 1).replace(/#/g, '&'));
  if (q.get('state') !== state) return { type: 'error' };
  const error = q.get('error');
  if (error) return error === 'access_denied' ? { type: 'denied' } : { type: 'error' };
  const idToken = q.get('id_token');
  return idToken ? { type: 'token', idToken } : { type: 'error' };
}
