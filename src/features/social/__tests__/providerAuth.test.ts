import { describe, expect, it } from '@jest/globals';
import { createHash } from 'crypto';
import { googleAuthUrl, googleRedirectUri, isPopup, makeNonce, randomCode, readGoogleReturn, type NonceCrypto } from '../providerAuth';

let seed = 7;
const crypto: NonceCrypto = {
  randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 131 + 17) % 256)),
  sha256Hex: async (text) => createHash('sha256').update(text).digest('hex'),
};

describe('sign in with Apple and Google', () => {
  it('makes a random code of letters and digits, and a nonce whose hash is what gets sent', async () => {
    const code = randomCode(crypto, 32);
    expect(code).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(randomCode(crypto, 32)).not.toBe(code);
    const n = await makeNonce(crypto);
    expect(n.hashed).toBe(createHash('sha256').update(n.raw).digest('hex'));
    expect(n.hashed).not.toContain(n.raw);
  });

  it('asks Google for an ID token for that nonce, answering to the website’s page', () => {
    const redirectUri = googleRedirectUri('https://afterglowmusic.app/');
    expect(redirectUri).toBe('https://afterglowmusic.app/google-auth');
    const url = new URL(googleAuthUrl({ clientId: 'web-client.apps.googleusercontent.com', redirectUri, state: 'st8', hashedNonce: 'abc123' }));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'web-client.apps.googleusercontent.com',
      redirect_uri: 'https://afterglowmusic.app/google-auth',
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce: 'abc123',
      state: 'st8',
      prompt: 'select_account',
    });
  });

  it('reads the answer the page passes on, only for the state it sent', () => {
    expect(readGoogleReturn('afterglow://google-auth?state=st8&id_token=eyJ.a.b&authuser=0', 'st8')).toEqual({ type: 'token', idToken: 'eyJ.a.b' });
    expect(readGoogleReturn('afterglow://google-auth#state=st8&id_token=eyJ.a.b', 'st8')).toEqual({ type: 'token', idToken: 'eyJ.a.b' });
    expect(readGoogleReturn('afterglow://google-auth?state=other&id_token=eyJ.a.b', 'st8')).toEqual({ type: 'error' });
    expect(readGoogleReturn('afterglow://google-auth?state=st8&error=access_denied', 'st8')).toEqual({ type: 'denied' });
    expect(readGoogleReturn('afterglow://google-auth?state=st8', 'st8')).toEqual({ type: 'error' });
    expect(readGoogleReturn('afterglow://google-auth', 'st8')).toEqual({ type: 'error' });
  });

  it('tells a website window from a token', () => {
    expect(isPopup({ provider: 'google', popup: true })).toBe(true);
    expect(isPopup({ provider: 'apple', idToken: 'x', rawNonce: 'y' })).toBe(false);
  });
});
