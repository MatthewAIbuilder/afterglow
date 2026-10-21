import { APPLE_ON_WEB, APPLE_SIGN_IN, GOOGLE_WEB_CLIENT_ID } from '../../config/social';
import type { ProviderProof, SignInProvider } from './providerAuth';

/**
 * The website: Firebase opens Apple's or Google's own window itself, so
 * there's nothing to fetch first (see providerSignIn.ts for the phone).
 */
export type ProviderResult = { type: 'proof'; proof: ProviderProof; name?: string } | { type: 'cancelled' } | { type: 'error' };

export async function availableProviders(): Promise<Record<SignInProvider, boolean>> {
  return { apple: APPLE_SIGN_IN && APPLE_ON_WEB, google: !!GOOGLE_WEB_CLIENT_ID };
}

export const signInWithProvider = async (p: SignInProvider): Promise<ProviderResult> => ({ type: 'proof', proof: { provider: p, popup: true } });
export const signInWithApple = () => signInWithProvider('apple');
export const signInWithGoogle = () => signInWithProvider('google');
