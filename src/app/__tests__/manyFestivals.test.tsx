import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp } from './appRoutes';

/**
 * The app with the nightly feed's many festivals: 25 extra (dated far ahead,
 * so they never go stale) on top of the built-in ones. Lists stay short.
 */
jest.mock('../../state/catalog', () => {
  const actual = jest.requireActual<typeof import('../../state/catalog')>('../../state/catalog');
  const { createCatalog } = jest.requireActual<typeof import('../../data/catalog')>('../../data/catalog');
  const base = actual.builtInCatalog;
  const extra = Array.from({ length: 25 }, (_, i) => ({
    id: `feed-fest-${i}`,
    name: `Feed Fest ${i}`,
    dates: 'Some day',
    location: 'Somewhere',
    lineup: [base.artists[i % base.artists.length].id],
    days: ['Saturday'],
    stages: [],
    startDate: `2031-0${1 + (i % 9)}-1${i % 10}`,
    endDate: `2031-0${1 + (i % 9)}-1${i % 10}`,
    // The first three are around Tampa, the fourth in Los Angeles.
    ...(i < 3 ? { place: { lat: 27.95 + i / 10, lon: -82.46 } } : i === 3 ? { place: { lat: 34.05, lon: -118.24 } } : {}),
  }));
  const big = createCatalog({ artists: base.artists, festivals: [...base.festivals, ...extra], clips: base.clips });
  return { ...actual, builtInCatalog: big, useCatalog: () => big };
});

const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 6; i++) await settle();
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('many festivals', () => {
  it('the Festivals tab shows a short shelf, with the rest behind More festivals', async () => {
    const app = await renderApp('/festivals');
    await flush();
    expect(app.getByText(/^(For you|Coming up)$/)).toBeTruthy();
    const more = app.getByLabelText(/^More festivals, \d+\. Show them$/);
    expect(app.queryByText('Feed Fest 24')).toBeNull();
    await fireEvent.press(more);
    await flush();
    expect(app.getByLabelText(/^Show more festivals\. \d+ left$/)).toBeTruthy();
    // Search still finds any of them.
    await fireEvent.changeText(app.getByLabelText('Find an artist or festival'), 'Feed Fest 24');
    await flush();
    expect(app.getAllByText('Feed Fest 24').length).toBeGreaterThan(0);
  });

  it('shows festivals near you once you allow your location, and forgets it when you turn it off', async () => {
    const Location = jest.requireMock<typeof import('expo-location')>('expo-location') as unknown as Record<string, jest.Mock>;
    Location.requestForegroundPermissionsAsync.mockImplementationOnce(async () => ({ granted: true }));
    Location.getCurrentPositionAsync.mockImplementationOnce(async () => ({ coords: { latitude: 28.5383, longitude: -81.3792 } }));
    Location.reverseGeocodeAsync.mockImplementationOnce(async () => [{ city: 'Orlando' }]);
    const app = await renderApp('/festivals');
    await flush();
    expect(app.queryByText('Near you')).toBeNull();
    await fireEvent.press(app.getByLabelText('Use my location'));
    await flush();
    expect(app.getByText('Near you')).toBeTruthy();
    expect(app.getByText(/^Within \d+ (mi|km) of Orlando$/)).toBeTruthy();
    // Nearest first, with how far; Los Angeles is out of reach.
    expect(app.getByText('Feed Fest 0')).toBeTruthy();
    expect(app.getAllByText(/ (mi|km) away$/).length).toBeGreaterThanOrEqual(3);
    expect(app.queryByText('Feed Fest 3')).toBeNull();
    // Kept on the phone, rounded.
    expect(JSON.parse((await AsyncStorage.getItem('nearYou.v1'))!)).toMatchObject({ lat: 28.54, lon: -81.38, label: 'Orlando' });
    await fireEvent.press(app.getByLabelText('Stop showing festivals near you'));
    await flush();
    expect(app.queryByText('Near you')).toBeNull();
    expect(app.getByLabelText('Use my location')).toBeTruthy();
    expect(await AsyncStorage.getItem('nearYou.v1')).toBeNull();
  });

  it('says so when location is refused', async () => {
    const app = await renderApp('/festivals');
    await flush();
    await fireEvent.press(app.getByLabelText('Use my location'));
    await flush();
    expect(app.getByText(/Location is off for Afterglow/)).toBeTruthy();
    expect(app.getByLabelText('Open Settings')).toBeTruthy();
  });

  it('the welcome finds your festival by name', async () => {
    await AsyncStorage.removeItem('welcomed.v1');
    const app = await renderApp('/welcome');
    await flush();
    await fireEvent.press(app.getByText(/^(Get started|Continue|Next)$/));
    await flush();
    expect(app.queryByText('Feed Fest 17')).toBeNull();
    await fireEvent.changeText(app.getByLabelText('Find your festival'), 'feed fest 17');
    await flush();
    await fireEvent.press(app.getByText('Feed Fest 17'));
    await flush();
    await fireEvent.changeText(app.getByLabelText('Find your festival'), '');
    await flush();
    // Your pick stays in view with the search cleared.
    expect(app.getByLabelText(/^Feed Fest 17, /).props.accessibilityState).toMatchObject({ checked: true });
  });

  it('My Sound’s festival picker searches', async () => {
    const app = await renderApp('/sound-scope');
    await flush();
    expect(app.queryByText('Feed Fest 3')).toBeNull();
    await fireEvent.changeText(app.getByLabelText('Find a festival'), 'Feed Fest 3');
    await flush();
    expect(app.getByText('Feed Fest 3')).toBeTruthy();
  });
});
