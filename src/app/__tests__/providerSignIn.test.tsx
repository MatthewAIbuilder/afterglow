import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/**
 * Sign in with Apple and with Google on the sign-in screen, through the real
 * routes: a new account goes on to making the profile (with Apple's name), a
 * returning one goes back, an email already used with a password says so,
 * deleting an Apple account confirms with Apple, and with them switched off
 * there are no buttons.
 */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));
jest.mock('../../config/social', () => {
  const actual = jest.requireActual<typeof import('../../config/social')>('../../config/social');
  const flags = { apple: true, google: 'web-client.apps.googleusercontent.com' };
  const out = { ...actual, __flags: flags };
  Object.defineProperty(out, 'APPLE_SIGN_IN', { get: () => flags.apple, enumerable: true });
  Object.defineProperty(out, 'GOOGLE_WEB_CLIENT_ID', { get: () => flags.google, enumerable: true });
  return out;
});
// A real SHA-256 and random bytes, so the nonce sent to Apple can be checked.
jest.mock('expo-crypto', () => {
  const node = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    getRandomBytes: (n: number) => Uint8Array.from(node.randomBytes(n)),
    digestStringAsync: async (_algorithm: string, text: string) => node.createHash('sha256').update(text).digest('hex'),
  };
});
const mockFlags = jest.requireMock<{ __flags: { apple: boolean; google: string } }>('../../config/social').__flags;

const apple = jest.requireMock<{ __state: { available: boolean; next: { identityToken: string; givenName?: string } | null; nonces: string[] } }>('expo-apple-authentication').__state;
const browser = WebBrowser.openAuthSessionAsync as unknown as jest.Mock<(url: string, ret: string) => Promise<{ type: string; url?: string }>>;

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 12) => {
  for (let i = 0; i < rounds; i++) await settle();
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  mockFlags.apple = true;
  mockFlags.google = 'web-client.apps.googleusercontent.com';
  apple.available = true;
  apple.next = { identityToken: 'sam', givenName: 'Sam Rivera' };
  apple.nonces = [];
  // Google answers the page with the state it was sent and a token standing for "lee".
  browser.mockImplementation(async (url) => {
    const q = new URL(url).searchParams;
    return { type: 'success', url: `afterglow://google-auth?state=${q.get('state')}&id_token=lee` };
  });
});

describe('sign in with Apple and Google', () => {
  it('a new Apple account goes on to making the profile, with the name Apple gave', async () => {
    const app = await renderApp('/');
    await flush();
    await act(async () => router.push('/account'));
    await flush();
    expect(app.getByText('or with email')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Continue with Apple'));
    await flush();
    // Only the hash of the one-time code went to Apple.
    expect(apple.nonces[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(mockSocial.service.availability().ok && (await new Promise((done) => mockSocial.service.onAuthChange((u) => done(u?.email))))).toBe('sam@apple.test');
    expect(app.getByLabelText('Name').props.value).toBe('Sam Rivera');
  });

  it('Google signs in through its page; a returning account just goes back', async () => {
    await mockSocial.service.signInWithProvider({ provider: 'google', idToken: 'lee', rawNonce: 'x' });
    await mockSocial.service.signOut();
    const app = await renderApp('/');
    await flush();
    await act(async () => router.push('/account'));
    await flush();
    await fireEvent.press(app.getByLabelText('Continue with Google'));
    await flush();
    const asked = new URL(browser.mock.calls[0][0]);
    expect(asked.searchParams.get('redirect_uri')).toBe('https://afterglowmusic.app/google-auth');
    expect(browser.mock.calls[0][1]).toBe('afterglow://google-auth');
    expect(app.queryByText('Create your profile')).toBeNull();
    expect(app.queryByLabelText('Name')).toBeNull();
  });

  it('an email already used with a password says to sign in with it; a closed sheet says nothing', async () => {
    await mockSocial.service.signUp('sam@apple.test', 'sam-pass');
    await mockSocial.service.signOut();
    const app = await renderApp('/');
    await flush();
    await act(async () => router.push('/account'));
    await flush();
    await fireEvent.press(app.getByLabelText('Continue with Apple'));
    await flush();
    expect(app.getByText('There’s already an Afterglow account with that email. Sign in with your email and password.')).toBeTruthy();
    apple.next = null;
    await fireEvent.press(app.getByLabelText('Continue with Apple'));
    await flush();
    expect(app.queryByText('Sign-in was cancelled.')).toBeNull();
  });

  it('deleting an Apple account confirms with Apple, not a password', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await mockSocial.service.signInWithProvider({ provider: 'apple', idToken: 'sam', rawNonce: 'x' });
    await mockSocial.service.saveProfile({ handle: 'sam', displayName: 'Sam', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    const app = await renderApp('/');
    await flush();
    await act(async () => router.push('/profile-edit'));
    await flush();
    await fireEvent.press(app.getByText('Delete account'));
    await flush();
    expect(app.queryByLabelText('Password to delete your account')).toBeNull();
    await fireEvent.press(app.getByLabelText('Continue with Apple'));
    await flush();
    expect(alert).toHaveBeenCalledWith('Account deleted', expect.any(String));
    alert.mockRestore();
  });

  it('switched off, there are no buttons, just email', async () => {
    mockFlags.apple = false;
    mockFlags.google = '';
    const app = await renderApp('/');
    await flush();
    await act(async () => router.push('/account'));
    await flush();
    expect(app.getByLabelText('Email')).toBeTruthy();
    expect(app.queryByLabelText('Continue with Apple')).toBeNull();
    expect(app.queryByLabelText('Continue with Google')).toBeNull();
    expect(app.queryByText('or with email')).toBeNull();
  });
});
