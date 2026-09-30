import { AuthRequest, makeRedirectUri, ResponseType } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { MUSIC_REDIRECT } from '../../../config/music';
import { SPOTIFY_ENDPOINTS, SPOTIFY_SCOPES } from './tokens';

// On web, finishes a sign-in that returned to this page. Does nothing on a phone.
WebBrowser.maybeCompleteAuthSession();

/**
 * Spotify's sign-in page, in the system's secure browser sheet
 * (ASWebAuthenticationSession on iPhone). Returns the one-time code and the
 * PKCE verifier to exchange it with; the app never sees your password.
 */
export type SpotifySignIn = (clientId: string) => Promise<
  | { type: 'code'; code: string; codeVerifier: string; redirectUri: string }
  | { type: 'cancelled' }
  | { type: 'denied' }
  | { type: 'error' }
>;

export const spotifySignIn: SpotifySignIn = async (clientId) => {
  const redirectUri = makeRedirectUri({ scheme: MUSIC_REDIRECT.scheme, path: MUSIC_REDIRECT.path });
  const request = new AuthRequest({
    clientId,
    redirectUri,
    scopes: [...SPOTIFY_SCOPES],
    responseType: ResponseType.Code,
    usePKCE: true,
  });
  const result = await request.promptAsync(SPOTIFY_ENDPOINTS);
  if (result.type === 'success' && result.params.code && request.codeVerifier) {
    return { type: 'code', code: result.params.code, codeVerifier: request.codeVerifier, redirectUri };
  }
  if (result.type === 'error') return result.params.error === 'access_denied' ? { type: 'denied' } : { type: 'error' };
  return { type: 'cancelled' };
};
