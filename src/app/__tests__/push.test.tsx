import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/** Push notifications: this phone's address goes to your crews and chats once you're signed in, and away when you sign out. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 10; i++) await settle();
};
const s = () => mockSocial.service;
async function person(handle: string) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: handle, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  jest.mocked(Notifications.requestPermissionsAsync).mockClear();
});

describe('push notifications', () => {
  it('registers this phone once you’re in a crew, asking once; signing out takes it away', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'undetermined', canAskAgain: true } as never);
    const maya = await person('maya');
    await s().createCrew('edc-orlando-26', 'Bass bunch');
    const app = await renderApp('/profile-edit');
    await flush();
    await settle(2000);
    await flush();
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockSocial.pushes.get(maya)).toEqual({ token: 'ExponentPushToken[test-phone]', lang: 'en' });

    const alert = jest.spyOn(Alert, 'alert');
    await fireEvent.press(app.getByText('Sign out'));
    const buttons = alert.mock.calls.at(-1)?.[2] ?? [];
    await act(async () => {
      buttons.find((b) => b.text === 'Sign out')?.onPress?.();
    });
    await flush();
    expect(mockSocial.pushes.has(maya)).toBe(false);
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'granted', canAskAgain: true } as never);
  });

  it('never asks while you’re in no crew or chat', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'undetermined', canAskAgain: true } as never);
    const maya = await person('maya');
    await renderApp('/profile');
    await flush();
    await settle(2000);
    await flush();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockSocial.pushes.has(maya)).toBe(false);
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'granted', canAskAgain: true } as never);
  });
});
