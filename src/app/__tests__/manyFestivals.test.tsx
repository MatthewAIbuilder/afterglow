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
