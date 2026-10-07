import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/** HQ's totem: a festival tablet showing the logo, now and then a sticker to scan and claim. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (n = 10) => {
  for (let i = 0; i < n; i++) await settle();
};
const s = () => mockSocial.service;
const SUPPORT = 'afterglowmusic.support@gmail.com';

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 10, 7, 21) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

describe('the totem', () => {
  it('HQ sets it up, starts it, and a sticker pops up to claim', async () => {
    mockSocial.verified.add(SUPPORT);
    await s().signUp(SUPPORT, 'password123');
    await s().addSticker({ code: 'potty00001', name: 'Portal potty · Main stage loos', creature: 'portapotty' });
    const app = await renderApp('/');
    await flush();
    await act(async () => router.push('/totem'));
    await flush();
    expect(app.getByText('Totem')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Portal potty · Main stage loos'));
    await fireEvent.press(app.getAllByText('1 minute')[0]);
    await fireEvent.changeText(app.getByLabelText('A line under the name'), 'Lost Lands · Stage 3');
    await flush();
    expect(JSON.parse((await AsyncStorage.getItem('totem.v1'))!)).toMatchObject({ codes: ['potty00001'], everyMin: 1, subtitle: 'Lost Lands · Stage 3' });
    await fireEvent.press(app.getByText('Start the totem'));
    await flush();
    expect(app.getByText('AFTERGLOW')).toBeTruthy();
    expect(app.getByText('Lost Lands · Stage 3')).toBeTruthy();
    expect(app.queryByText('FREE COLLECTIBLE · SCAN TO CLAIM')).toBeNull();
    // A minute on, the sticker pops up.
    await settle(61_000);
    await flush();
    expect(app.getByText('FREE COLLECTIBLE · SCAN TO CLAIM')).toBeTruthy();
    expect(app.getByText('Portal potty · Main stage loos')).toBeTruthy();
    // Half a minute later it's gone again (up for half the gap at most).
    await settle(31_000);
    await flush();
    expect(app.queryByText('FREE COLLECTIBLE · SCAN TO CLAIM')).toBeNull();
    // A tap shows the controls: pop one now, and stop.
    await fireEvent.press(app.getByLabelText('Show the controls'));
    await flush();
    await fireEvent.press(app.getByText('Pop one now'));
    await flush();
    expect(app.getByText('FREE COLLECTIBLE · SCAN TO CLAIM')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Show the controls'));
    await flush();
    await fireEvent.press(app.getByText('Stop the totem'));
    await flush();
    expect(app.getByText('Start the totem')).toBeTruthy();
  }, 30000);

  it('is HQ’s only', async () => {
    await s().signUp('maya@example.com', 'password123');
    const app = await renderApp('/totem');
    await flush();
    expect(app.queryByText('Start the totem')).toBeNull();
  });
});
