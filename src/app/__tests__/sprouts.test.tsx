import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { sproutLink } from '../../features/sprouts/sprouts';
import { renderApp } from './appRoutes';

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
const person = async (handle: string, name: string) => {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
};
const as = (handle: string) => s().signIn(`${handle}@example.com`, 'password123');
const ID = 'abcdefghijkmnpqrstuv';
const linkFrom = (uid: string, kind: 'seedling' | 'plur' = 'plur') => sproutLink({ id: ID, kind, from: uid, handle: 'maya', name: 'Maya' });
/** Maya gives a sprout (straight to the backend) and signs out. */
const mayaGives = async (kind: 'seedling' | 'plur' = 'plur') => {
  const maya = await person('maya', 'Maya');
  await s().giveSprout({ id: ID, kind, note: 'So glad we met' });
  await s().signOut();
  return maya;
};
const routeOf = (uid: string) => `/sprout/${ID}?u=${uid}&h=maya&k=plur&n=Maya`;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 3, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  notifications.__scheduled.clear();
  network.__setState({ isConnected: true, isInternetReachable: true });
});
afterEach(() => {
  network.__setState({ isConnected: true, isInternetReachable: true });
});

describe('sprouts', () => {
  it('giving one shows a code, spends a seed, and says when someone picks it up', async () => {
    await person('maya', 'Maya');
    const app = await renderApp('/give-sprout');
    await flush();
    expect(app.getByText('5 of 5 seeds left today')).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('A note with your sprout'), 'So glad we met');
    await fireEvent.press(app.getByText('Show the code'));
    await flush();
    expect(app.getByLabelText('A code for your Sprout. Someone scans it to pick it up.')).toBeTruthy();
    expect(app.getByText('Waiting for them to scan it…')).toBeTruthy();
    const [given] = [...mockSocial.sprouts.values()];
    expect(given).toMatchObject({ kind: 'seedling', note: 'So glad we met' });
    // Sam picks it up on their phone.
    await s().signOut();
    await person('sam', 'Sam');
    await s().claimSprout(given.id);
    await as('maya');
    await flush();
    await settle(4500);
    await flush();
    expect(app.getByText('Picked up by Sam. It’s in their garden now.')).toBeTruthy();
    await fireEvent.press(app.getByText('Give another'));
    await flush();
    expect(app.getByText('4 of 5 seeds left today')).toBeTruthy();
    // The bell has it too.
    await act(async () => router.push('/notifications'));
    await flush();
    expect(app.getByText('Sam picked up your Sprout')).toBeTruthy();
  });

  it('a scanned sprout pops up and joins your garden with one tap', async () => {
    const maya = await mayaGives();
    await person('sam', 'Sam');
    const app = await renderApp(routeOf(maya));
    await flush();
    expect(app.getByText('Maya gave you a PLUR sprout')).toBeTruthy();
    expect(app.getByText('“So glad we met”')).toBeTruthy();
    await fireEvent.press(app.getByText('Add to my garden'));
    await flush();
    expect(app.getByText('In your garden')).toBeTruthy();
    expect(mockSocial.sprouts.get(ID)?.to).toBe(mockSocial.currentUser()?.uid);
    await fireEvent.press(app.getByText('See your garden'));
    await flush();
    expect(app.getByLabelText('PLUR sprout, from Maya. In bloom.')).toBeTruthy();
    expect(app.getByLabelText(/^Sprout, Your first sprout\. Seed/)).toBeTruthy();
    expect(app.getByText('Kinds · 1 of 7')).toBeTruthy();
  });

  it('without an account, the sprout is kept on the phone and picked up once you sign up', async () => {
    const maya = await mayaGives();
    const app = await renderApp(routeOf(maya));
    await flush();
    expect(app.getByText('Keep it: make a free Afterglow account and it’ll be waiting in your garden.')).toBeTruthy();
    await fireEvent.press(app.getByText('Create a free account'));
    await flush();
    expect(JSON.parse((await AsyncStorage.getItem('sprouts.v1')) ?? '{}').claims[0].card.id).toBe(ID);
    const sam = await person('sam', 'Sam');
    await flush(20);
    expect(mockSocial.sprouts.get(ID)?.to).toBe(sam);
  });

  it('with no signal, a scan is kept and goes through by itself once there’s signal', async () => {
    const maya = await mayaGives();
    await person('sam', 'Sam');
    network.__setState({ isConnected: false, isInternetReachable: false });
    mockSocial.network.down = true;
    const app = await renderApp('/scan');
    await flush();
    await fireEvent(app.getByTestId('camera-view'), 'barcodeScanned', { data: linkFrom(maya), type: 'qr' });
    await flush();
    await fireEvent.press(app.getByText('Add to my garden'));
    await flush();
    expect(app.getByText('Saved on your phone. It joins your garden by itself once you’ve both had signal.')).toBeTruthy();
    expect(mockSocial.sprouts.get(ID)?.to).toBeUndefined();
    mockSocial.network.down = false;
    network.__setState({ isConnected: true, isInternetReachable: true });
    await flush();
    await settle(20_000);
    await flush();
    expect(mockSocial.sprouts.get(ID)?.to).toBeDefined();
    expect(app.getByText('In your garden')).toBeTruthy();
    expect(notifications.__scheduled.get(`sprout:${ID}`)?.content.title).toBe('Your sprout from Maya is in your garden');
  });

  it('a sprout someone else picked up says so', async () => {
    const maya = await mayaGives();
    await person('jojo', 'Jo');
    await s().claimSprout(ID);
    await s().signOut();
    await person('sam', 'Sam');
    const app = await renderApp(routeOf(maya));
    await flush();
    await fireEvent.press(app.getByText('Add to my garden'));
    await flush();
    expect(app.getByText('Someone else already picked this one up.')).toBeTruthy();
  });

  it('your own sprout can’t be picked up by you', async () => {
    const maya = await mayaGives();
    await as('maya');
    const app = await renderApp(routeOf(maya));
    await flush();
    expect(app.getByText('Your PLUR sprout')).toBeTruthy();
    expect(app.queryByText('Add to my garden')).toBeNull();
  });

  it('the Friends tab and Profile lead to sprouts', async () => {
    await person('maya', 'Maya');
    const app = await renderApp('/together');
    await flush();
    await fireEvent.press(app.getByLabelText('Give someone a sprout'));
    await flush();
    expect(app.getByText('Show the code')).toBeTruthy();
  });
});
