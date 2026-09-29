import { describe, expect, it, jest } from '@jest/globals';
import { createHash, randomBytes } from 'crypto';
import * as WebBrowser from 'expo-web-browser';
import {
  makePkce,
  randomToken,
  readAuthReturn,
  redirectUriFrom,
  spotifyAuthRequest,
  toBase64Url,
  type AuthCrypto,
} from '../spotify/auth';
import { SPOTIFY_REDIRECT_URI, spotifySignIn } from '../spotify/signIn';

/**
 * The Spotify sign-in round trip: PKCE, the authorize link, and reading the
 * answer. Node's crypto stands in for the phone's; nothing opens a browser or
 * contacts Spotify.
 */
jest.mock('expo-crypto', () => {
  const c = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    getRandomBytes: (n: number) => new Uint8Array(c.randomBytes(n)),
    digestStringAsync: async (_alg: string, text: string) => c.createHash('sha256').update(text).digest('base64'),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    CryptoEncoding: { BASE64: 'base64' },
  };
});

const nodeCrypto: AuthCrypto = {
  randomBytes: (n) => new Uint8Array(randomBytes(n)),
  sha256Base64: async (t) => createHash('sha256').update(t).digest('base64'),
};
const REDIRECT = 'afterglow://music-auth';
const params = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe('PKCE', () => {
  it('computes the S256 challenge exactly as RFC 7636 specifies', async () => {
    // The RFC's own example (Appendix B).
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(toBase64Url(await nodeCrypto.sha256Base64(verifier))).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('makes a fresh 64-character verifier from the allowed characters each time', async () => {
    const a = await makePkce(nodeCrypto);
    const b = await makePkce(nodeCrypto);
    expect(a.verifier).toMatch(/^[A-Za-z0-9\-._~]{64}$/);
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).toBe(toBase64Url(createHash('sha256').update(a.verifier).digest('base64')));
    expect(a.challenge).not.toMatch(/[+/=]/);
  });

  it('never biases characters, even when the random source gives only high bytes at first', () => {
    let calls = 0;
    const skewed: AuthCrypto = { ...nodeCrypto, randomBytes: (n) => (calls++ === 0 ? new Uint8Array(n).fill(250) : new Uint8Array(randomBytes(n))) };
    expect(randomToken(skewed, 40)).toHaveLength(40);
  });
});

describe('the authorize link', () => {
  it('asks for a code with PKCE, the three read scopes, the redirect and a random state', async () => {
    const r = await spotifyAuthRequest('client-123', REDIRECT, nodeCrypto);
    expect(r.url.startsWith('https://accounts.spotify.com/authorize?')).toBe(true);
    const p = params(r.url);
    expect(p).toMatchObject({
      client_id: 'client-123',
      response_type: 'code',
      redirect_uri: REDIRECT,
      code_challenge_method: 'S256',
      scope: 'user-library-read user-follow-read user-top-read',
    });
    expect(p.state).toBe(r.state);
    expect(p.state.length).toBeGreaterThanOrEqual(32);
    expect(p.code_challenge).toBe(toBase64Url(createHash('sha256').update(r.verifier).digest('base64')));
    // No client secret, no implicit grant.
    expect(r.url).not.toMatch(/client_secret|response_type=token/);
  });

  it('uses a new state for every sign-in', async () => {
    const a = await spotifyAuthRequest('c', REDIRECT, nodeCrypto);
    const b = await spotifyAuthRequest('c', REDIRECT, nodeCrypto);
    expect(a.state).not.toBe(b.state);
  });
});

describe('reading what Spotify sends back', () => {
  const expected = { state: 'state-abc', redirectUri: REDIRECT };

  it('a matching state with a code is a successful sign-in', () => {
    expect(readAuthReturn(`${REDIRECT}?code=AQD%2Fcode&state=state-abc`, expected)).toEqual({ type: 'code', code: 'AQD/code' });
  });

  it('refuses an answer whose state is missing or different, even with a code', () => {
    expect(readAuthReturn(`${REDIRECT}?code=stolen&state=someone-else`, expected)).toEqual({ type: 'mismatch' });
    expect(readAuthReturn(`${REDIRECT}?code=stolen`, expected)).toEqual({ type: 'mismatch' });
  });

  it('refuses an answer sent to another address', () => {
    expect(readAuthReturn('evil://music-auth?code=x&state=state-abc', expected)).toEqual({ type: 'mismatch' });
    expect(readAuthReturn(`${REDIRECT}-other?code=x&state=state-abc`, expected)).toEqual({ type: 'mismatch' });
  });

  it('you said no: access_denied with the right state', () => {
    expect(readAuthReturn(`${REDIRECT}?error=access_denied&state=state-abc`, expected)).toEqual({ type: 'denied' });
    // A denial that isn't for this sign-in isn't believed either.
    expect(readAuthReturn(`${REDIRECT}?error=access_denied&state=nope`, expected)).toEqual({ type: 'mismatch' });
  });

  it('any other error, or no code at all, is an error', () => {
    expect(readAuthReturn(`${REDIRECT}?error=invalid_client&state=state-abc`, expected)).toEqual({ type: 'error' });
    expect(readAuthReturn(`${REDIRECT}?state=state-abc`, expected)).toEqual({ type: 'error' });
    expect(readAuthReturn(`${REDIRECT}?code=%E0%A4%A&state=state-abc`, expected)).toEqual({ type: 'error' });
  });

  it('works with an https universal-link redirect too', () => {
    const https = { state: 's', redirectUri: 'https://afterglow.example.com/music-auth' };
    expect(readAuthReturn('https://afterglow.example.com/music-auth?code=c&state=s', https)).toEqual({ type: 'code', code: 'c' });
  });
});

describe('the redirect address setting', () => {
  it('defaults to the app scheme, and accepts a custom scheme or an https link', () => {
    expect(redirectUriFrom(undefined, REDIRECT)).toBe(REDIRECT);
    expect(redirectUriFrom('  ', REDIRECT)).toBe(REDIRECT);
    expect(redirectUriFrom('com.afterglow.app://music-auth', REDIRECT)).toBe('com.afterglow.app://music-auth');
    expect(redirectUriFrom('https://afterglow.example.com/music-auth', REDIRECT)).toBe('https://afterglow.example.com/music-auth');
  });

  it('ignores addresses Spotify refuses or that would break the check', () => {
    for (const bad of ['http://afterglow.example.com/cb', 'http://localhost:8081', 'exp://192.168.1.4:8081/--/music-auth', 'https://x.com/cb?next=1', 'not a url']) {
      expect(redirectUriFrom(bad, REDIRECT)).toBe(REDIRECT);
    }
  });

  it('this build sends people back to afterglow://music-auth', () => {
    expect(SPOTIFY_REDIRECT_URI).toBe(REDIRECT);
  });
});

describe('the sign-in sheet', () => {
  const open = WebBrowser.openAuthSessionAsync as jest.MockedFunction<typeof WebBrowser.openAuthSessionAsync>;
  const answerWith = (make: (sent: Record<string, string>) => string) =>
    open.mockImplementationOnce(async (url) => ({ type: 'success', url: make(params(url)) }));

  it('returns the code and the verifier that belong to this request', async () => {
    answerWith((sent) => `${REDIRECT}?code=one-time&state=${sent.state}`);
    const r = await spotifySignIn('cid');
    expect(r).toMatchObject({ type: 'code', code: 'one-time', redirectUri: REDIRECT });
    const sent = params(open.mock.calls.at(-1)![0]);
    if (r.type !== 'code') throw new Error('expected a code');
    expect(toBase64Url(createHash('sha256').update(r.codeVerifier).digest('base64'))).toBe(sent.code_challenge);
    expect(open.mock.calls.at(-1)![1]).toBe(REDIRECT);
  });

  it('a forged or stale answer (wrong state) is an error: no code comes out', async () => {
    answerWith(() => `${REDIRECT}?code=forged&state=old-state`);
    expect(await spotifySignIn('cid')).toEqual({ type: 'error' });
  });

  it('closing the sheet is cancelled; saying no is denied; a sheet that won’t open is an error', async () => {
    open.mockImplementationOnce(async () => ({ type: WebBrowser.WebBrowserResultType.CANCEL }));
    expect(await spotifySignIn('cid')).toEqual({ type: 'cancelled' });
    answerWith((sent) => `${REDIRECT}?error=access_denied&state=${sent.state}`);
    expect(await spotifySignIn('cid')).toEqual({ type: 'denied' });
    open.mockImplementationOnce(async () => {
      throw new Error('WebBrowser is already open');
    });
    expect(await spotifySignIn('cid')).toEqual({ type: 'error' });
  });
});
