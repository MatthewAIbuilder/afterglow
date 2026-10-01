import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp } from './appRoutes';
import { builtInCatalog } from '../../state/catalog';

/** New sets news through the real routes: clips that arrived since the last look, for an artist you love. */
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

describe('new sets news', () => {
  it('the bell says an artist you love has a new set, and tapping it plays it', async () => {
    const loved = builtInCatalog.clips.find((c) => c.source)!;
    const name = builtInCatalog.artist(loved.artistId)!.name;
    const others = builtInCatalog.clips.filter((c) => c.artistId !== loved.artistId).map((c) => c.id);
    await AsyncStorage.setItem('clipNews.v1', JSON.stringify({ seen: others, news: [] }));
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ [loved.artistId]: 'love' }));
    const app = await renderApp('/notifications');
    await flush();
    const notice = app.getByText(new RegExp(`^(A new live set|New live sets) from ${name}$`));
    const saved = JSON.parse((await AsyncStorage.getItem('clipNews.v1'))!);
    expect(saved.news[0].clips).toContain(loved.id);
    await fireEvent.press(notice);
    await flush();
    // Back in Discover, on that clip.
    expect(app.queryByText(/live sets? from/)).toBeNull();
    expect(app.getAllByText(loved.title).length).toBeGreaterThan(0);
  });

  it('a first look is quiet', async () => {
    const loved = builtInCatalog.clips[0];
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ [loved.artistId]: 'love' }));
    const app = await renderApp('/notifications');
    await flush();
    expect(app.queryByText(/live sets? from/)).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem('clipNews.v1'))!).seen.length).toBe(builtInCatalog.clips.length);
  });
});
