import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp } from './appRoutes';
import { alsoWatch } from '../../features/discover/nextToWatch';
import { similarityWith } from '../../features/taste/similarity';
import { builtInCatalog } from '../../state/catalog';

/** Artist pages lead on: their clips, unwatched first, and a clip each from artists who sound like them. */
const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 8; i++) await settle();
};
const similarity = similarityWith(builtInCatalog.similarities);
// An artist with clips whose sound-alikes have clips too.
const artist = builtInCatalog.artists.find(
  (a) => builtInCatalog.clipsOf(a.id).length > 0 && alsoWatch(a, builtInCatalog.artists, builtInCatalog.clipsOf, similarity, {}).length > 1,
)!;
const fans = alsoWatch(artist, builtInCatalog.artists, builtInCatalog.clipsOf, similarity, {});

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('next to watch on artist pages', () => {
  it('shows fans also watch, and marks clips you’ve watched', async () => {
    const watched = builtInCatalog.clipsOf(artist.id)[0];
    await AsyncStorage.setItem('seen.v1', JSON.stringify({ [watched.id]: Date.now() }));
    const app = await renderApp(`/artist/${artist.id}`);
    await flush();
    expect(app.getByText('Fans also watch')).toBeTruthy();
    expect(app.getAllByLabelText(new RegExp(`^Play ${fans[0].artist.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `)).length).toBeGreaterThan(0);
    expect(app.getAllByLabelText(new RegExp(`^Play ${watched.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, watched$`)).length).toBe(1);
  });

  it('tapping one plays it in Discover', async () => {
    const app = await renderApp(`/artist/${artist.id}`);
    await flush();
    await fireEvent.press(app.getAllByLabelText(new RegExp(`^Play ${fans[0].artist.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `))[0]);
    await flush();
    // Back in Discover (tests only draw the top of the feed, so the clip itself may be further down).
    expect(app.getAllByLabelText(/Choose what to discover\.$/).length).toBeGreaterThan(0);
    expect(app.queryByText('Fans also watch')).toBeNull();
  });
});
