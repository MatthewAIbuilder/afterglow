import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { WEB_URL } from '../../config/app';
import { APPLE_SIGN_IN, GOOGLE_WEB_CLIENT_ID } from '../../config/social';
import { GOOGLE_APP_RETURN, googleAuthUrl, googleRedirectUri, makeNonce, randomCode, readGoogleReturn, type NonceCrypto, type ProviderProof, type SignInProvider } from './providerAuth';

/**
 * Sign in with Apple (Apple's own sheet, iPhone only) and with Google (its
 * page in the system's secure browser sheet), on a phone. Each hands back a
 * token for Firebase; the app never sees a password. The website has its own
 * version (providerSignIn.web.ts) that uses Firebase's windows instead.
 */
export type ProviderResult = { type: 'proof'; proof: ProviderProof; name?: string } | { type: 'cancelled' } | { type: 'error' };

const phoneCrypto: NonceCrypto = {
  randomBytes: (n) => Crypto.getRandomBytes(n),
  sha256Hex: (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
};

/** Which buttons to show on this phone. */
export async function availableProviders(): Promise<Record<SignInProvider, boolean>> {
  const apple = APPLE_SIGN_IN && Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync().catch(() => false));
  return { apple, google: !!GOOGLE_WEB_CLIENT_ID };
}

export async function signInWithApple(): Promise<ProviderResult> {
  try {
    const nonce = await makeNonce(phoneCrypto);
    const c = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: nonce.hashed,
    });
    if (!c.identityToken) return { type: 'error' };
    // Apple gives the name only the first time: it fills in your profile's name.
    const name = c.fullName ? AppleAuthentication.formatFullName(c.fullName).trim() : '';
    return {
      type: 'proof',
      proof: { provider: 'apple', idToken: c.identityToken, rawNonce: nonce.raw, ...(c.authorizationCode ? { authorizationCode: c.authorizationCode } : {}) },
      ...(name ? { name } : {}),
    };
  } catch (e) {
    return (e as { code?: string })?.code === 'ERR_REQUEST_CANCELED' ? { type: 'cancelled' } : { type: 'error' };
  }
}

export async function signInWithGoogle(): Promise<ProviderResult> {
  if (!GOOGLE_WEB_CLIENT_ID) return { type: 'error' };
  try {
    const nonce = await makeNonce(phoneCrypto);
    const state = randomCode(phoneCrypto, 24);
    const url = googleAuthUrl({ clientId: GOOGLE_WEB_CLIENT_ID, redirectUri: googleRedirectUri(WEB_URL), state, hashedNonce: nonce.hashed });
    const result = await WebBrowser.openAuthSessionAsync(url, GOOGLE_APP_RETURN);
    if (result.type !== 'success') return { type: 'cancelled' };
    const answer = readGoogleReturn(result.url, state);
    if (answer.type === 'denied') return { type: 'cancelled' };
    if (answer.type !== 'token') return { type: 'error' };
    return { type: 'proof', proof: { provider: 'google', idToken: answer.idToken, rawNonce: nonce.raw } };
  } catch {
    // The sheet couldn't open (another one is already open, or the browser is missing).
    return { type: 'error' };
  }
}

export const signInWithProvider = (p: SignInProvider) => (p === 'apple' ? signInWithApple() : signInWithGoogle());
