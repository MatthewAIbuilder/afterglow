import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, Linking } from 'react-native';
import { flagMenu } from '../../features/discover/flagMenu';
import { soundcloudClip } from '../../features/discover/soundcloud';
import { renderApp } from './appRoutes';

/**
 * Artists' SoundCloud pages, from the hosted catalogue file (the nightly
 * match): Listen on the artist page offers it first, and a SoundCloud card
 * in Discover can be flagged like a clip. Every artist has a page here.
 * (Discover's virtualized feed only draws its top cards in tests, and a
 * SoundCloud card is never among the first five: the feed tests cover where they go.)
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
    soundcloud: Object.fromEntries(BUILT_IN.snapshot.artists.map((a) => [a.id, { url: `https://soundcloud.com/${a.id}`, name: a.name }])),
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
const first = BUILT_IN.snapshot.artists[0];

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('SoundCloud pages', () => {
  it('Listen on an artist page offers their SoundCloud page first, and opens it', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((_o, cb) => cb(0));
    const app = await renderApp(`/artist/${first.id}`);
    await flush();
    await fireEvent.press(app.getByLabelText(`Listen to ${first.name}`));
    expect(sheet.mock.calls[0][0].options).toEqual(['SoundCloud', 'YouTube', 'Spotify', 'Cancel']);
    expect(open).toHaveBeenCalledWith(`https://soundcloud.com/${first.id}`);
  });

  it('"Wrong artist" on a SoundCloud card hides that artist’s page and offers a report', async () => {
    const flag = jest.fn();
    const card = soundcloudClip(first.id, { url: `https://soundcloud.com/${first.id}` });
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((o, cb) => {
      expect(o.title).toBe('What’s wrong with this SoundCloud page?');
      expect(o.options).toEqual(['Wrong artist', 'Doesn’t play', 'Something else', 'Cancel']);
      cb(0);
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    flagMenu(card, first.name, `https://soundcloud.com/${first.id}`, { flag, unflag: jest.fn() });
    expect(flag).toHaveBeenCalledWith(`soundcloud:${first.id}`, 'wrong-artist');
    expect(alert.mock.calls[0][0]).toBe('Page hidden');
  });
});
