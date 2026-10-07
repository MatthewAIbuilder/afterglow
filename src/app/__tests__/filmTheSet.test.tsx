import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderApp } from './appRoutes';

/**
 * "Film the set": on the night of an artist's show (or opened from a code
 * handed out there, `?film=1`) their page offers the camera, and the tagging
 * sheet starts on them and that show.
 */
jest.mock('../../state/catalog', () => {
  const actual = jest.requireActual<typeof import('../../state/catalog')>('../../state/catalog');
  const { BUILT_IN } = jest.requireActual<typeof import('../../data/bundled')>('../../data/bundled');
  const { parseCatalogFile } = jest.requireActual<typeof import('../../data/file')>('../../data/file');
  const { buildCatalog } = jest.requireActual<typeof import('../../data/merge')>('../../data/merge');
  const file = {
    version: 1,
    mode: 'add',
    artists: [],
    festivals: [],
    clips: [],
    shows: [{ id: 'edm-9', date: '2026-10-09', venue: 'The Criterion', location: 'Oklahoma City, OK', link: 'https://edmtrain.com/oklahoma-city-ok/levity-9', artists: ['levity'] }],
  };
  const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(JSON.stringify(file)), { needClips: false });
  return { ...actual, builtInCatalog: built.catalog, useCatalog: () => built.catalog };
});

const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 10; i++) await settle();
};

const at = (day: number) => jest.useFakeTimers({ now: new Date(2026, 9, day, 21) });

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});
afterEach(() => {
  jest.useRealTimers();
});

describe('film the set', () => {
  it('on the night of their show, opens the camera on them and that show', async () => {
    at(9);
    const push = jest.spyOn(router, 'push');
    const app = await renderApp('/artist/levity');
    await flush();
    expect(app.getByText('TONIGHT · THE CRITERION')).toBeTruthy();
    expect(app.getByText('Film the set')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Film LEVITY'));
    expect(push).toHaveBeenCalledWith({ pathname: '/camera', params: { artist: 'levity', show: 'edm-9' } });
    push.mockRestore();
  });

  it('shows from a printed code on any night, and not otherwise', async () => {
    at(3);
    const app = await renderApp('/artist/levity?film=1');
    await flush();
    expect(app.getByText('AT THE SHOW?')).toBeTruthy();
    await act(async () => router.push('/artist/subtronics'));
    await flush();
    expect(app.queryByText('Film the set')).toBeNull();
  });

  it('the tagging sheet starts on the artist and the show', async () => {
    at(9);
    await AsyncStorage.setItem('memories.v1', JSON.stringify([{ id: 'm1', file: 'm1.mov', capturedAt: '2026-10-10T02:00:00.000Z', addedAt: '2026-10-10T02:00:00.000Z' }]));
    const app = await renderApp('/memory-tag?id=m1&fresh=1&artist=levity&show=edm-9');
    await flush();
    expect(app.getByLabelText(/^LEVITY/).props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(app.getAllByText('The Criterion, Oklahoma City').length).toBeGreaterThan(0);
  });
});
