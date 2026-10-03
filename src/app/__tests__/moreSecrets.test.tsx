import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const found = async () => JSON.parse((await AsyncStorage.getItem('secrets.v1')) ?? '{}');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 3, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

describe('more secrets', () => {
  it('tapping a festival pin seven times polishes it', async () => {
    const app = await renderApp('/badge/cyclops-cove-4');
    await flush();
    for (let i = 0; i < 7; i++) {
      await fireEvent.press(app.getByTestId('badge-pin'));
      await settle(100);
    }
    await flush();
    expect(app.getByTestId('secret-fireworks')).toBeTruthy();
    expect(await found()).toHaveProperty('pinspin');
  });

  it('opening the app between 2 and 4 in the morning finds the night owl', async () => {
    jest.setSystemTime(new Date(2026, 9, 4, 2, 30));
    const app = await renderApp('/');
    await flush(40);
    expect(app.getByTestId('secret-sparkle')).toBeTruthy();
    expect(await found()).toHaveProperty('nightowl');
    expect(await found()).not.toHaveProperty('sunrise');
  });

  it('trying every colour of your friend code in one go finds True colours', async () => {
    await mockSocial.service.signUp('maya@example.com', 'password123');
    await mockSocial.service.saveProfile({ handle: 'maya', displayName: 'Maya', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    const app = await renderApp('/my-code');
    await flush();
    for (const label of ['Sunset', 'Ocean']) {
      await fireEvent.press(app.getByLabelText(`${label} colours`));
      await settle();
    }
    expect(await found()).not.toHaveProperty('colours');
    await fireEvent.press(app.getByLabelText('Aurora colours'));
    await flush();
    expect(app.getByTestId('secret-hearts')).toBeTruthy();
    expect(await found()).toHaveProperty('colours');
  });
});
