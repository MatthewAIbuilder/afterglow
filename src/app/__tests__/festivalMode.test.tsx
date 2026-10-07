import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { friendLink } from '../../features/friends/qr';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp, showTab } from './appRoutes';

/** Festival mode (the simpler app on festival nights, and its test), and adding friends by QR code with or without signal. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const network = jest.requireMock<{ __setState: (s: { isConnected?: boolean; isInternetReachable?: boolean }) => void }>('expo-network');
const notifications = jest.requireMock<{ __scheduled: Map<string, { content: { title: string } }> }>('expo-notifications');
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;
async function person(handle: string, name: string) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}
const as = (handle: string) => s().signIn(`${handle}@example.com`, 'password123');
const follows = (from: string, to: string) => mockSocial.follows.has(`${from}>${to}`);

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 2, 14, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
  notifications.__scheduled.clear();
  network.__setState({ isConnected: true, isInternetReachable: true });
});
afterEach(() => {
  network.__setState({ isConnected: true, isInternetReachable: true });
});

describe('festival mode', () => {
  it('can be tested any day from Settings: the festival tabs, the camera in the middle, and a way out', async () => {
    const app = await renderApp('/settings');
    await flush();
    await fireEvent.press(app.getByLabelText(/^Test festival mode with .*: see how the app looks on festival day$/));
    await flush();
    // The tabs: Discover, Lineup, the camera, Friends, Profile.
    expect(app.getByLabelText('Film a video')).toBeTruthy();
    expect(app.getByRole('tab', { name: 'Friends' })).toBeTruthy();
    expect(app.queryByRole('tab', { name: 'My Sound' })).toBeNull();
    expect(app.queryByRole('tab', { name: 'Festivals' })).toBeNull();
    // Discover is the festival's, and with nothing filmed there yet the lineup's sets stand in.
    expect(app.getByLabelText(/, videos filmed here\. Open tonight\.$/)).toBeTruthy();
    expect(app.getByText('Test: lineup sets stand in for videos filmed here')).toBeTruthy();
    // Lineup is your night, planned for you, as if it were the first night.
    await showTab(app, 'Lineup');
    await flush();
    expect(app.getByText('Test · tonight')).toBeTruthy();
    expect(app.getByText('Set to set')).toBeTruthy();
    // The banner over the tabs ends it.
    await fireEvent.press(app.getByLabelText(/^Testing festival mode with .*\. End the test$/));
    await flush();
    expect(app.getByRole('tab', { name: 'My Sound' })).toBeTruthy();
    expect(app.queryByLabelText('Film a video')).toBeNull();
  });

  it('asks on a festival night, and switching shows Discover from the festival', async () => {
    jest.setSystemTime(new Date(2026, 11, 5, 22, 0));
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    const app = await renderApp('/');
    await flush();
    // Tonight opens by itself, with the question.
    expect(app.getByText('Switch to festival mode?')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Switch to festival mode'));
    await flush();
    expect(app.getByLabelText('Cyclops Cove 4, videos filmed here. Open tonight.')).toBeTruthy();
    expect(app.getByLabelText('Film a video')).toBeTruthy();
    // Not a test, so no banner.
    expect(app.queryByLabelText(/^Testing festival mode/)).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem('festivalMode.v1')) ?? '{}').choices).toEqual({ 'cyclops-cove-4': 'on' });
  });
});

describe('friends by QR code', () => {
  it('shows your code, and scanning a friend’s makes you follow each other', async () => {
    const maya = await person('maya', 'Maya');
    await s().setFriendCode('mayacode2345');
    await s().signOut();
    const sam = await person('sam', 'Sam');
    const app = await renderApp('/friends');
    await flush();
    await fireEvent.press(app.getByLabelText('Show my friend code'));
    await flush();
    expect(app.getByLabelText('Your friend code, @sam. A friend scans it with Afterglow to become friends.')).toBeTruthy();
    // Sam's code reached Afterglow in the background.
    await fireEvent.press(app.getByLabelText('Ocean colours'));
    await fireEvent.press(app.getByLabelText("Scan a friend's code"));
    await flush();
    await fireEvent(app.getByTestId('camera-view'), 'barcodeScanned', { data: 'https://example.com/menu', type: 'qr' });
    await flush();
    expect(app.getByText('That isn’t an Afterglow friend code, sprout, kandi or sticker.')).toBeTruthy();
    await fireEvent(app.getByTestId('camera-view'), 'barcodeScanned', {
      data: friendLink({ uid: maya, handle: 'maya', name: 'Maya', code: 'mayacode2345' }),
      type: 'qr',
    });
    await flush();
    expect(app.getByText('You and Maya are friends')).toBeTruthy();
    expect(follows(sam, maya) && follows(maya, sam)).toBe(true);
    expect(JSON.parse((await AsyncStorage.getItem('friendAdds.v1')) ?? '{}').theme).toBe('ocean');
  });

  it('with no signal, keeps the scan, says so, and adds them by itself once there’s signal', async () => {
    const maya = await person('maya', 'Maya');
    await s().setFriendCode('mayacode2345');
    await s().signOut();
    const sam = await person('sam', 'Sam');
    network.__setState({ isConnected: false, isInternetReachable: false });
    mockSocial.network.down = true;
    const app = await renderApp('/friends');
    await flush();
    await fireEvent.press(app.getByLabelText("Scan a friend's code"));
    await flush();
    await fireEvent(app.getByTestId('camera-view'), 'barcodeScanned', {
      data: friendLink({ uid: maya, handle: 'maya', name: 'Maya', code: 'mayacode2345' }),
      type: 'qr',
    });
    await flush();
    expect(app.getByText('Saved Maya')).toBeTruthy();
    expect(app.getByText(/You’ll be friends with Maya as soon as there’s signal/)).toBeTruthy();
    expect(follows(sam, maya)).toBe(false);
    await fireEvent.press(app.getByText('Done'));
    await flush();
    expect(app.getByText('Scanned · 1 waiting for signal')).toBeTruthy();
    // Signal comes back: it goes through by itself, and a notification says so.
    mockSocial.network.down = false;
    network.__setState({ isConnected: true, isInternetReachable: true });
    await flush();
    await settle(20_000);
    await flush();
    expect(follows(sam, maya) && follows(maya, sam)).toBe(true);
    expect(app.getByText('Friends now')).toBeTruthy();
    expect(notifications.__scheduled.get(`friend-added:${maya}`)?.content.title).toBe('You and Maya are friends now');
  });

  it('a friend link opened from a phone camera adds them too', async () => {
    const maya = await person('maya', 'Maya');
    await s().setFriendCode('mayacode2345');
    await s().signOut();
    await person('sam', 'Sam');
    await as('sam');
    const app = await renderApp(`/add/maya?u=${maya}&c=mayacode2345&n=Maya`);
    await flush();
    expect(app.getByText('Maya wants to be friends on Afterglow. You’ll follow each other.')).toBeTruthy();
    await fireEvent.press(app.getByText('Be friends'));
    await flush();
    expect(app.getByText('You and Maya are friends now. You follow each other.')).toBeTruthy();
  });

  it('scanning your own code says so', async () => {
    const sam = await person('sam', 'Sam');
    const app = await renderApp('/friends');
    await flush();
    await fireEvent.press(app.getByLabelText("Scan a friend's code"));
    await flush();
    await fireEvent(app.getByTestId('camera-view'), 'barcodeScanned', { data: friendLink({ uid: sam, handle: 'sam', name: 'Sam', code: 'samcode23456' }), type: 'qr' });
    await flush();
    expect(app.getByText('That’s your own code. Scan a friend’s.')).toBeTruthy();
  });
});
