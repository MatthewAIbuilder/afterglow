import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { renderApp } from './appRoutes';

/**
 * Where they play: festival dates and club shows for the artists you follow
 * and love, in one date-ordered schedule with filters. Dated far ahead so
 * they never go stale.
 */
jest.mock('../../state/catalog', () => {
  const actual = jest.requireActual<typeof import('../../state/catalog')>('../../state/catalog');
  const { BUILT_IN } = jest.requireActual<typeof import('../../data/bundled')>('../../data/bundled');
  const { parseCatalogFile } = jest.requireActual<typeof import('../../data/file')>('../../data/file');
  const { buildCatalog } = jest.requireActual<typeof import('../../data/merge')>('../../data/merge');
  const [a, b] = BUILT_IN.snapshot.artists;
  const file = {
    version: 1,
    mode: 'add',
    artists: [],
    festivals: [{ id: 'glow-fest-31', name: 'Glow Fest 2031', dates: '20 Feb 2031', location: 'Austin, Texas', start: '2031-02-20', end: '2031-02-20', lineup: [a.id] }],
    clips: [],
    shows: [
      { id: 'edm-1', date: '2031-01-11', name: 'Halloween Night', venue: 'Club 1', location: 'Denver, CO', link: 'https://edmtrain.com/denver-co/club-1', artists: [a.id, b.id] },
      { id: 'edm-9', date: '2031-03-05', venue: 'Club 9', location: 'Chicago, IL', link: 'https://edmtrain.com/chicago-il/club-9', artists: [a.id] },
      { id: 'edm-0', date: '2020-01-01', venue: 'Long Gone Club', location: 'Denver, CO', link: 'https://edmtrain.com/denver-co/gone', artists: [a.id] },
    ],
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
  for (let i = 0; i < 8; i++) await settle();
};

const { BUILT_IN } = jest.requireActual<typeof import('../../data/bundled')>('../../data/bundled');
const [first, second] = BUILT_IN.snapshot.artists;
const MINE = /^.+ at (Halloween Night|Glow Fest 2031|Club 9|Long Gone Club), /;

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  await AsyncStorage.setItem('followedArtists.v1', JSON.stringify([first.id, second.id]));
});

describe('where they play', () => {
  it('lists festivals and club shows in date order, filters them, and opens a show on EDMTrain', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const app = await renderApp('/your-artists');
    await flush();
    expect(app.getAllByText('Where they play').length).toBeGreaterThan(0);
    expect(app.getByText(/^\d+ artists? you follow and love$/)).toBeTruthy();
    expect(app.getByText('January 2031')).toBeTruthy();
    expect(app.getByText('February 2031')).toBeTruthy();

    const order = () => app.getAllByLabelText(MINE).map((n) => (n.props.accessibilityLabel as string).match(MINE)![1]);
    expect(order()).toEqual(['Halloween Night', 'Glow Fest 2031', 'Club 9']);
    // Both of your artists on the same night: one row, both faces.
    expect(app.getByLabelText(new RegExp(`^${first.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} and .+ at Halloween Night, \\w+ 11 January\\. Club 1, Denver, CO\\. Show\\. Opens the event page on EDMTrain\\.$`))).toBeTruthy();
    expect(app.getByLabelText(/at Glow Fest 2031, Thursday 20 February\. Austin, Texas\. Festival\. Opens the festival\.$/)).toBeTruthy();

    await fireEvent.press(app.getByLabelText(/^Shows, \d+$/));
    await flush();
    expect(order()).toEqual(['Halloween Night', 'Club 9']);
    await fireEvent.press(app.getByLabelText(/^Festivals, \d+$/));
    await flush();
    expect(order()).toEqual(['Glow Fest 2031']);
    await fireEvent.press(app.getByLabelText(/^Near you, \d+$/));
    await flush();
    expect(app.queryAllByLabelText(MINE)).toHaveLength(0);
    expect(app.getByText('Turn on your location to see which dates are near you.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^All dates, \d+$/));
    await flush();

    await fireEvent.press(app.getByLabelText(/at Club 9, /));
    expect(open).toHaveBeenCalledWith('https://edmtrain.com/chicago-il/club-9');
    // Your artists stay below, with Follow.
    expect(app.getByText('Your artists')).toBeTruthy();
    expect(app.getAllByLabelText(`Following ${first.name}. Tap to unfollow.`).length).toBeGreaterThan(0);
    open.mockRestore();
  });

  it('Profile shows where the next of them plays under Your artists', async () => {
    const app = await renderApp('/profile');
    await flush();
    expect(app.getByLabelText(/^Next: .+ · .+\. See where they play\.$/)).toBeTruthy();
  });
});
