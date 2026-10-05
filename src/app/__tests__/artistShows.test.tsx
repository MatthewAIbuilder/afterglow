import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { renderApp } from './appRoutes';

/**
 * Artist pages list their club shows from the hosted catalogue file (the
 * nightly EDMTrain feed): the next five, "See all", each opening its
 * EDMTrain page. Shows are dated far ahead so they never go stale; one is over.
 */
jest.mock('../../state/catalog', () => {
  const actual = jest.requireActual<typeof import('../../state/catalog')>('../../state/catalog');
  const { BUILT_IN } = jest.requireActual<typeof import('../../data/bundled')>('../../data/bundled');
  const { parseCatalogFile } = jest.requireActual<typeof import('../../data/file')>('../../data/file');
  const { buildCatalog } = jest.requireActual<typeof import('../../data/merge')>('../../data/merge');
  const [a, b] = BUILT_IN.snapshot.artists;
  const at = (n: number, extra: object = {}) => ({
    id: `edm-${n}`,
    date: `2031-0${n}-1${n}`,
    venue: `Club ${n}`,
    location: 'Denver, CO',
    link: `https://edmtrain.com/denver-co/club-${n}`,
    artists: [a.id],
    ...extra,
  });
  const file = {
    version: 1,
    mode: 'add',
    artists: [],
    festivals: [],
    clips: [],
    shows: [
      at(1, { name: 'Halloween Night', artists: [a.id, b.id] }),
      at(2),
      at(3),
      at(4),
      at(5),
      at(6),
      at(7),
      { ...at(8), date: '2020-01-01', venue: 'Long Gone Club' },
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
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('shows on artist pages', () => {
  it('lists the next five upcoming shows, with who else plays, and opens each on EDMTrain', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const app = await renderApp(`/artist/${first.id}`);
    await flush();
    expect(app.getByText('Upcoming shows')).toBeTruthy();
    expect(app.getByText('Halloween Night')).toBeTruthy();
    expect(app.getByText('Club 1, Denver, CO')).toBeTruthy();
    expect(app.getByText(`with ${second.name}`)).toBeTruthy();
    expect(app.getByText('Club 5')).toBeTruthy();
    expect(app.queryByText('Club 6')).toBeNull();
    expect(app.queryByText('Long Gone Club')).toBeNull();
    expect(app.getByText('Show info from EDMTrain ↗')).toBeTruthy();

    await fireEvent.press(app.getByLabelText(new RegExp(`^Halloween Night, \\w+ 11 January\\. Club 1, Denver, CO\\. With ${esc(second.name)}\\. Opens the event page on EDMTrain\\.$`)));
    expect(open).toHaveBeenCalledWith('https://edmtrain.com/denver-co/club-1');

    await fireEvent.press(app.getByLabelText('See all 7 shows'));
    await flush();
    expect(app.getByText('Club 7')).toBeTruthy();
    expect(app.getByLabelText('Show fewer shows')).toBeTruthy();
    open.mockRestore();
  });

  it('shows the other artist only the show they share, and nothing for artists without shows', async () => {
    const app = await renderApp(`/artist/${second.id}`);
    await flush();
    expect(app.getByText('Halloween Night')).toBeTruthy();
    expect(app.getByText(`with ${first.name}`)).toBeTruthy();
    expect(app.queryByText('Club 2')).toBeNull();
    expect(app.queryByLabelText(/^See all \d+ shows$/)).toBeNull();

    const third = BUILT_IN.snapshot.artists[2];
    const other = await renderApp(`/artist/${third.id}`);
    await flush();
    expect(other.queryByText('Upcoming shows')).toBeNull();
  });
});
