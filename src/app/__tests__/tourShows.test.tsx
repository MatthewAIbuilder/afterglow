import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { renderApp } from './appRoutes';

/**
 * An artist's tour on the map carries their upcoming club shows (from the
 * nightly EDMTrain feed) as well as their festivals: small lights, in the
 * date-ordered line and the cards. Shows are dated far ahead so they never
 * go stale; one is over and one has no place.
 */
jest.mock('../../state/catalog', () => {
  const actual = jest.requireActual<typeof import('../../state/catalog')>('../../state/catalog');
  const { BUILT_IN } = jest.requireActual<typeof import('../../data/bundled')>('../../data/bundled');
  const { parseCatalogFile } = jest.requireActual<typeof import('../../data/file')>('../../data/file');
  const { buildCatalog } = jest.requireActual<typeof import('../../data/merge')>('../../data/merge');
  const show = (id: string, date: string, artist: string, extra: object = {}) => ({
    id,
    date,
    venue: `Club ${id}`,
    location: 'Denver, CO',
    place: { lat: 39.74, lon: -104.99 },
    link: `https://edmtrain.com/denver-co/${id}`,
    artists: [artist],
    ...extra,
  });
  const file = {
    version: 1,
    mode: 'add',
    // Someone on no festival yet, with one show.
    artists: [{ id: 'club-act', name: 'Club Act' }],
    festivals: [],
    clips: [],
    shows: [
      show('edm-1', '2031-03-14', 'subtronics', { name: 'Riddim Night' }),
      show('edm-2', '2031-05-02', 'subtronics', { location: 'Chicago, IL', place: { lat: 41.88, lon: -87.63 } }),
      show('edm-3', '2031-06-01', 'subtronics', { place: undefined }),
      show('edm-4', '2020-01-01', 'subtronics'),
      show('edm-5', '2031-04-04', 'club-act'),
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


beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe("an artist's tour with their shows", () => {
  it('shows their upcoming shows with a place beside their festivals, in date order, and opens a show on EDMTrain', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const app = await renderApp('/artist/subtronics');
    await flush();
    await fireEvent.press(app.getByLabelText("See SUBTRONICS's festivals and shows on the map"));
    await flush();
    expect(app.getByText('SUBTRONICS on tour')).toBeTruthy();
    expect(app.getByText(/ and 2 shows, in date order$/)).toBeTruthy();
    // Small lights for the two shows with a place; not the one without, nor the past one.
    expect(app.getByTestId('map-show-edm-1')).toBeTruthy();
    expect(app.getByTestId('map-show-edm-2')).toBeTruthy();
    expect(app.queryByTestId('map-show-edm-3')).toBeNull();
    expect(app.queryByTestId('map-show-edm-4')).toBeNull();
    // Festivals keep their lights and cards; the shows' cards follow in date order (2031, after them).
    expect(app.getByTestId('map-light-cyclops-cove-4')).toBeTruthy();
    const order = app.getAllByTestId(/^map-card-/).map((c) => c.props.testID as string);
    expect(order.slice(-2)).toEqual(['map-card-edm-1', 'map-card-edm-2']);
    expect(order.indexOf('map-card-cyclops-cove-4')).toBeGreaterThanOrEqual(0);

    // A show's card: day, name, venue and town, "Show".
    expect(app.getByText('Riddim Night')).toBeTruthy();
    expect(app.getByText('Club edm-1, Denver, CO')).toBeTruthy();
    expect(app.getByText('Club edm-2')).toBeTruthy();
    expect(app.getByText('Chicago, IL')).toBeTruthy();
    expect(app.getAllByText(/^Show · /).length).toBe(2);

    // Tapping its light chooses it; tapping its chosen card opens the event page.
    await fireEvent.press(app.getByTestId('map-show-edm-2'));
    await flush();
    expect(app.getByTestId('map-show-edm-2').props.accessibilityState).toEqual({ selected: true });
    expect(open).not.toHaveBeenCalled();
    await fireEvent.press(app.getByTestId('map-card-edm-2'));
    await flush();
    expect(open).toHaveBeenCalledWith('https://edmtrain.com/denver-co/edm-2');
    open.mockRestore();
  });

  it('an artist with shows but no festivals still gets their tour, from the shows', async () => {
    const app = await renderApp('/artist/club-act');
    await flush();
    expect(app.getByText('Upcoming shows')).toBeTruthy();
    await fireEvent.press(app.getByLabelText("See Club Act's festivals and shows on the map"));
    await flush();
    expect(app.getByText('Club Act on tour')).toBeTruthy();
    expect(app.getByText('1 show')).toBeTruthy();
    expect(app.getByTestId('map-card-edm-5')).toBeTruthy();
  });
});
