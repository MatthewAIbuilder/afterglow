import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { MUSIC_REDIRECT, SPOTIFY_REDIRECT_SETTING } from '../../../config/music';
import { isUniversalLink, readAuthReturn, redirectUriFrom, spotifyAuthRequest, type AuthCrypto } from './auth';

/** The address Spotify sends you back to: registered in the Spotify dashboard exactly like this. */
export const SPOTIFY_REDIRECT_URI = redirectUriFrom(SPOTIFY_REDIRECT_SETTING, `${MUSIC_REDIRECT.scheme}://${MUSIC_REDIRECT.path}`);

// On web, finishes a sign-in that returned to this page. Does nothing on a phone.
WebBrowser.maybeCompleteAuthSession();

/**
 * Spotify's sign-in page, in the system's secure browser sheet
 * (ASWebAuthenticationSession on iPhone, a Custom Tab on Android). Returns
 * the one-time code and the PKCE verifier to exchange it with; the app never
 * sees your password. The request and the answer are built and checked in
 * auth.ts (state must match, only the redirect address counts).
 */
export type SpotifySignIn = (clientId: string) => Promise<
  | { type: 'code'; code: string; codeVerifier: string; redirectUri: string }
  | { type: 'cancelled' }
  | { type: 'denied' }
  | { type: 'error' }
>;

const phoneCrypto: AuthCrypto = {
  randomBytes: (n) => Crypto.getRandomBytes(n),
  sha256Base64: (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text, { encoding: Crypto.CryptoEncoding.BASE64 }),
};

export const spotifySignIn: SpotifySignIn = async (clientId) => {
  try {
    const request = await spotifyAuthRequest(clientId, SPOTIFY_REDIRECT_URI, phoneCrypto);
    const result = await WebBrowser.openAuthSessionAsync(request.url, request.redirectUri, {
      // An https redirect needs the universal-link callback (iOS 17.4+ and the Associated Domains entitlement).
      preferUniversalLinks: isUniversalLink(request.redirectUri),
    });
    if (result.type !== 'success') return { type: 'cancelled' };
    const answer = readAuthReturn(result.url, request);
    if (answer.type === 'code') return { type: 'code', code: answer.code, codeVerifier: request.verifier, redirectUri: request.redirectUri };
    if (answer.type === 'denied') return { type: 'denied' };
    return { type: 'error' };
  } catch {
    // The sheet couldn't open (another one is already open, or the browser is missing).
    return { type: 'error' };
  }
};
