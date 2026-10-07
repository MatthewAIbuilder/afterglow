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
    await s().recordFind('potty00001', Date.now());
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
    // A teaser counts down to the next one.
    expect(app.getByLabelText('Next one in 1:00')).toBeTruthy();
    // A minute on, the sticker pops up.
    await settle(61_000);
    await flush();
    expect(app.getByText('FREE COLLECTIBLE · SCAN TO CLAIM')).toBeTruthy();
    expect(app.getByText('Portal potty · Main stage loos')).toBeTruthy();
    // How many people have claimed it so far.
    expect(app.getByText('Claimed by 1 person')).toBeTruthy();
    // Someone scans it: the count goes up and the totem says so.
    mockSocial.finds.set('someone_potty00001', Date.now());
    await settle(15_000);
    await flush();
    expect(app.getByText('✦ Just claimed! 2 so far')).toBeTruthy();
    // Half a minute later it's gone again (up for half the gap at most), and the totem keeps count.
    await settle(16_000);
    await flush();
    expect(app.queryByText('FREE COLLECTIBLE · SCAN TO CLAIM')).toBeNull();
    expect(app.getByText('✦ 1 claimed since the totem started')).toBeTruthy();
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

  it('puts a whole hunt on the totem in one tap', async () => {
    mockSocial.verified.add(SUPPORT);
    await s().signUp(SUPPORT, 'password123');
    const hunt = await s().addHunt({ id: 'lostlands27', name: 'Lost Lands 2027' });
    await s().addSticker({ code: 'potty00001', name: 'Portal potty · Lost Lands', creature: 'portapotty', huntId: hunt.id });
    await s().addSticker({ code: 'water00001', name: 'Refill · Lost Lands', creature: 'refill', huntId: hunt.id });
    const app = await renderApp('/');
    await flush();
    await act(async () => router.push('/totem'));
    await flush();
    await fireEvent.press(app.getByLabelText('Use every sticker in Lost Lands 2027'));
    await flush();
    expect(JSON.parse((await AsyncStorage.getItem('totem.v1'))!).codes).toEqual(['potty00001', 'water00001']);
  }, 30000);

  it('is HQ’s only', async () => {
    await s().signUp('maya@example.com', 'password123');
    const app = await renderApp('/totem');
    await flush();
    expect(app.queryByText('Start the totem')).toBeNull();
  });
});
