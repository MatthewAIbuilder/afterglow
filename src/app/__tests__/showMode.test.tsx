import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { renderApp, showTab } from './appRoutes';

/**
 * Festival mode at a one-night show: going to a show tonight asks the same
 * question as a festival night; switching on gives Discover from the show
 * (the bill's sets until videos come in), the night on the Lineup tab
 * (directions, tickets, the bill) and the camera. A show page can test it.
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
    festivals: [],
    clips: [],
    shows: [
      { id: 'edm-1', date: '2026-10-09', name: 'Halloween Night', venue: 'Club One', location: 'Denver, CO', link: 'https://edmtrain.com/denver-co/halloween', artists: [a.id, b.id] },
      { id: 'edm-2', date: '2026-10-20', venue: 'Club Two', location: 'Denver, CO', link: 'https://edmtrain.com/denver-co/club-2', artists: [a.id] },
    ],
  };
  const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(JSON.stringify(file)), { needClips: false });
  return { ...actual, builtInCatalog: built.catalog, useCatalog: () => built.catalog };
});

jest.setTimeout(30_000);

const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};

const { BUILT_IN } = jest.requireActual<typeof import('../../data/bundled')>('../../data/bundled');
const [first, second] = BUILT_IN.snapshot.artists;

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('festival mode at a show', () => {
  it('asks on the night of a show you’re going to; switching on gives the show’s Discover and the night on Lineup', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 9, 21, 0) });
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await AsyncStorage.setItem('goingShows.v1', JSON.stringify([{ id: 'edm-1', date: '2026-10-09', title: 'Halloween Night', where: 'Denver, CO', artistIds: [first.id, second.id] }]));
    const app = await renderApp('/');
    await flush();
    // Tonight opens by itself for the show, with the question.
    expect(app.getByText('Friday at Halloween Night')).toBeTruthy();
    expect(app.getByText('Switch to festival mode?')).toBeTruthy();
    expect(app.getByText('A simpler app tonight: videos filmed at the show, the bill best for you first, the camera one tap away, and your friends.')).toBeTruthy();
    expect(app.getByText('On the bill')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Switch to festival mode'));
    await flush();

    // Discover is the show's; with nothing filmed there yet, the bill's sets stand in.
    expect(app.getByLabelText('Halloween Night, videos filmed here. Open tonight.')).toBeTruthy();
    expect(app.getByText('Sets from tonight’s bill, until videos come in')).toBeTruthy();
    expect(app.getByLabelText('Film a video')).toBeTruthy();

    // Lineup: the night at a glance.
    await showTab(app, 'Lineup');
    await flush();
    expect(app.getByText('Tonight')).toBeTruthy();
    expect(app.getByText(/ · Club One, Denver, CO$/)).toBeTruthy();
    expect(app.getAllByText('On the bill').length).toBeGreaterThan(0);
    expect(app.getAllByText(first.name).length).toBeGreaterThan(0);
    await fireEvent.press(app.getByLabelText('Directions to Club One, Denver, CO. Opens your maps app.'));
    expect(open).toHaveBeenLastCalledWith('https://maps.apple.com/?daddr=Club%20One%2C%20Denver%2C%20CO');
    await fireEvent.press(app.getByLabelText('Tickets for Halloween Night. Opens their site.'));
    expect(open).toHaveBeenLastCalledWith('https://edmtrain.com/denver-co/halloween');
    open.mockRestore();
  });

  it('a show page can test festival mode any day', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 7, 14, 0) });
    const app = await renderApp('/show/edm-2');
    await flush();
    await fireEvent.press(app.getByLabelText(/^Test festival mode with Club Two\. A simpler app tonight/));
    await flush();
    expect(app.getByLabelText('Club Two, videos filmed here. Open tonight.')).toBeTruthy();
    expect(app.getByText('Test: lineup sets stand in for videos filmed here')).toBeTruthy();
    await showTab(app, 'Lineup');
    await flush();
    expect(app.getByText('Test · tonight')).toBeTruthy();
    expect(app.getByText('The bill works without signal.')).toBeTruthy();
    // The banner over the tabs ends it.
    await fireEvent.press(app.getByLabelText('Testing festival mode with Club Two. End the test'));
    await flush();
    expect(app.getByRole('tab', { name: 'My Sound' })).toBeTruthy();
  });
});
