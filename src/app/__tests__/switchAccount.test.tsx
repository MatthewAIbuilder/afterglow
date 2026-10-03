import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { forgetGuestView } from '../../state/adminView';
import { forgetSavedAccounts } from '../../state/savedAccounts';
import { renderApp } from './appRoutes';

/** Holding the Profile tab to switch between accounts saved on this phone, through the real routes. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const keychain = jest.requireMock<{ __items: Map<string, string> }>('expo-secure-store').__items;
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 12) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;
const SUPPORT = 'afterglowmusic.support@gmail.com';

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 10, 7, 12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  keychain.clear();
  mockSocial = fakeSocial();
  forgetGoers();
  forgetGuestView();
  forgetSavedAccounts();
  mockSocial.verified.add(SUPPORT);
  await s().signUp(SUPPORT, 'support-pass');
  await s().signUp('maya@example.com', 'maya-pass');
  await s().saveProfile({ handle: 'maya', displayName: 'Maya', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
});

describe('switching accounts', () => {
  it('holds Profile, saves this account, adds the support account, and switches back in one tap', async () => {
    const app = await renderApp('/');
    await flush();
    await fireEvent(app.getByRole('tab', { name: 'Profile' }), 'longPress');
    await flush();
    expect(app.getByText('Switch account')).toBeTruthy();

    // Save the account you're in.
    await fireEvent.press(app.getByText('Save this account'));
    await fireEvent.changeText(app.getByLabelText('Password'), 'maya-pass');
    await fireEvent.press(app.getByText('Save'));
    await flush();
    expect(app.getByLabelText('Maya, signed in')).toBeTruthy();
    expect([...keychain.values()]).toEqual(['maya-pass']);
    expect(await AsyncStorage.getItem('savedAccounts.v1')).not.toContain('maya-pass');

    // A wrong password never signs you out.
    await fireEvent.press(app.getByText('Add an account'));
    await fireEvent.changeText(app.getByLabelText('Email'), SUPPORT);
    await fireEvent.changeText(app.getByLabelText('Password'), 'nope');
    await fireEvent.press(app.getByText('Sign in'));
    await flush();
    expect(app.getByText('That email and password don’t match.')).toBeTruthy();
    expect(mockSocial.currentUser()?.email).toBe('maya@example.com');

    // The right one opens the dashboard.
    await fireEvent.changeText(app.getByLabelText('Password'), 'support-pass');
    await fireEvent.press(app.getByText('Sign in'));
    await flush();
    expect(mockSocial.currentUser()?.email).toBe(SUPPORT);
    expect(app.getByText('Dashboard')).toBeTruthy();

    // From the dashboard, back to Maya without typing anything.
    await fireEvent.press(app.getByLabelText('Switch account'));
    await flush();
    await fireEvent.press(app.getByLabelText('Switch to Maya'));
    await flush();
    expect(mockSocial.currentUser()?.email).toBe('maya@example.com');
    expect(app.queryByText('Dashboard')).toBeNull();
  });

  it('asks again when a saved password stops working, without signing you out', async () => {
    await AsyncStorage.setItem('savedAccounts.v1', JSON.stringify([{ uid: mockSocial.currentUser()!.uid, email: 'maya@example.com', name: 'Maya', savedAt: 'x' }, { uid: 'uid-1', email: SUPPORT, savedAt: 'x' }]));
    keychain.set('afterglow.account.uid-1', 'old-pass');
    const app = await renderApp('/switch-account');
    await flush();
    await fireEvent.press(app.getByLabelText(`Switch to ${SUPPORT}`));
    await flush();
    expect(app.getByText('The saved password didn’t work. Type it again.')).toBeTruthy();
    expect(keychain.has('afterglow.account.uid-1')).toBe(false);
    expect(mockSocial.currentUser()?.email).toBe('maya@example.com');
  });
});
