import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking, Share } from 'react-native';
import { renderApp } from './appRoutes';

/**
 * Club shows from the nightly EDMTrain feed, recommended and easy to reach:
 * the Festivals tab's "Shows for you" shelf, the show page (tickets on
 * EDMTrain, calendar, share), See all with filters and search, the tab's
 * search, and artist pages' "Upcoming shows". Shows are dated from today, so
 * they never go stale. You love the first artist and turned down the third.
 */
jest.mock('../../state/catalog', () => {
  const actual = jest.requireActual<typeof import('../../state/catalog')>('../../state/catalog');
  const { BUILT_IN } = jest.requireActual<typeof import('../../data/bundled')>('../../data/bundled');
  const { parseCatalogFile } = jest.requireActual<typeof import('../../data/file')>('../../data/file');
  const { buildCatalog } = jest.requireActual<typeof import('../../data/merge')>('../../data/merge');
  const [a, b, c] = BUILT_IN.snapshot.artists;
  const day = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const file = {
    version: 1,
    mode: 'add',
    artists: [],
    festivals: [],
    clips: [],
    shows: [
      { id: 'edm-1', date: day(2), name: 'Halloween Night', venue: 'Club One', location: 'Denver, CO', link: 'https://edmtrain.com/denver-co/halloween', artists: [a.id, b.id] },
      { id: 'edm-2', date: day(12), venue: 'Club Two', location: 'Denver, CO', link: 'https://edmtrain.com/denver-co/club-2', artists: [a.id] },
      { id: 'edm-3', date: day(45), venue: 'Warehouse Three', location: 'Austin, TX', link: 'https://edmtrain.com/austin-tx/w3', artists: [a.id] },
      { id: 'edm-4', date: day(3), venue: 'Not For Me Club', location: 'Denver, CO', link: 'https://edmtrain.com/denver-co/nfm', artists: [c.id] },
    ],
  };
  const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(JSON.stringify(file)), { needClips: false });
  return { ...actual, builtInCatalog: built.catalog, useCatalog: () => built.catalog };
});

// Each case renders the whole app a few times over.
jest.setTimeout(30_000);

const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 8; i++) await settle();
};

const { BUILT_IN } = jest.requireActual<typeof import('../../data/bundled')>('../../data/bundled');
const [first, , third] = BUILT_IN.snapshot.artists;

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ [first.id]: 'love', [third.id]: 'pass' }));
});

describe('shows for you', () => {
  it('the Festivals tab recommends shows; a card opens the show page with tickets on EDMTrain', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const app = await renderApp('/festivals');
    await flush();
    expect(app.getByText('Festivals & shows')).toBeTruthy();
    expect(app.getByText('Shows for you')).toBeTruthy();
    expect(app.getByText('Halloween Night')).toBeTruthy();
    // A show only an artist you turned down plays isn't recommended.
    expect(app.queryByText('Not For Me Club')).toBeNull();

    await fireEvent.press(app.getByLabelText(/^Halloween Night, \w+ \d+ \w+\. Club One, Denver, CO\. \d+ percent match with .+\. Opens the show\.$/));
    await flush();
    expect(app.getByText('Show')).toBeTruthy();
    expect(app.getByText('Club One, Denver, CO')).toBeTruthy();
    expect(app.getByText('On the bill')).toBeTruthy();
    expect(app.getByLabelText(new RegExp(`^${first.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, \\d+ percent match`))).toBeTruthy();
    expect(app.getByLabelText('Add Halloween Night to your calendar')).toBeTruthy();
    expect(app.getByText('Show info from EDMTrain ↗')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Get tickets on EDMTrain for Halloween Night. Opens their site.'));
    expect(open).toHaveBeenCalledWith('https://edmtrain.com/denver-co/halloween');
    open.mockRestore();
  });

  it('shares a link to the show on the website', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const app = await renderApp('/show/edm-2');
    await flush();
    await fireEvent.press(app.getByLabelText('Share Club Two'));
    await flush();
    const message = (share.mock.calls[0][0] as { message: string }).message;
    expect(message).toContain('https://afterglowmusic.app/show/edm-2');
    expect(message).toContain('Club Two');
    share.mockRestore();
  });

  it('See all lists every show with filters and a search', async () => {
    const app = await renderApp('/festivals');
    await flush();
    await fireEvent.press(app.getByLabelText('See all shows'));
    await flush();
    expect(app.getByText('Club nights and concerts, best for you first.')).toBeTruthy();
    expect(app.getByText('Warehouse Three')).toBeTruthy();
    expect(app.getByText('Not For Me Club')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Shows in the next 7 days, 2'));
    await flush();
    expect(app.getByText('Halloween Night')).toBeTruthy();
    expect(app.queryByText('Club Two')).toBeNull();
    expect(app.queryByText('Warehouse Three')).toBeNull();
    await fireEvent.press(app.getByLabelText('All upcoming shows, 4'));
    await fireEvent.changeText(app.getByLabelText('Find a show by artist, venue or town'), 'austin');
    await flush();
    expect(app.getByText('Warehouse Three')).toBeTruthy();
    expect(app.queryByText('Club Two')).toBeNull();
    await fireEvent.changeText(app.getByLabelText('Find a show by artist, venue or town'), 'zzz');
    await flush();
    expect(app.getByText('No show matches “zzz”.')).toBeTruthy();
    // Near you asks for your location first.
    await fireEvent.press(app.getByLabelText('Shows near you'));
    await flush();
    expect(app.getByText('Shows near you')).toBeTruthy();
    expect(app.getByLabelText('Use my location')).toBeTruthy();
  });

  it('the Festivals tab search finds a show and opens it', async () => {
    const app = await renderApp('/festivals');
    await flush();
    await fireEvent.changeText(app.getByLabelText('Find an artist, festival or show'), 'warehouse');
    await flush();
    expect(app.getByText('Shows')).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^Warehouse Three, .* Opens the show\.$/));
    await flush();
    expect(app.getByText('Austin, TX')).toBeTruthy();
    expect(app.getByLabelText('Get tickets on EDMTrain for Warehouse Three. Opens their site.')).toBeTruthy();
  });

  it('an artist page row opens the show page, and an old link says the show is gone', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const app = await renderApp(`/artist/${first.id}`);
    await flush();
    expect(app.getByText('Upcoming shows')).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^Club Two, .* Opens the show\.$/));
    await flush();
    expect(open).not.toHaveBeenCalled();
    expect(app.getByLabelText('Get tickets on EDMTrain for Club Two. Opens their site.')).toBeTruthy();
    await act(async () => router.push('/show/edm-gone'));
    await flush();
    expect(app.getByText('Show not found')).toBeTruthy();
    open.mockRestore();
  });
});
