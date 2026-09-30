import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderApp } from './appRoutes';
import { builtInCatalog } from '../../state/catalog';

/** Lineup news through the real routes: an act you love added to a lineup since you last looked (the demo Solstice, which has no dates, so it's never over). */
const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 8; i++) await settle();
};
const edc = builtInCatalog.festival('solstice-26')!;

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('lineup news', () => {
  it('the bell says an artist you love was added, and the lineup marks them', async () => {
    const seen = Object.fromEntries(builtInCatalog.festivals.map((f) => [f.id, f.id === edc.id ? f.lineup.filter((a) => a !== 'subtronics' && a !== 'tape-b') : f.lineup]));
    await AsyncStorage.setItem('lineupNews.v1', JSON.stringify({ seen, news: [] }));
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ subtronics: 'love', 'tape-b': 'pass' }));
    const app = await renderApp('/notifications');
    await flush();
    expect(app.getByText('SUBTRONICS was added to Solstice 2026')).toBeTruthy();
    // Someone you passed on isn't news.
    expect(app.queryByText(/TAPE B/)).toBeNull();
    const saved = JSON.parse((await AsyncStorage.getItem('lineupNews.v1'))!);
    expect(saved.news[0].artists.sort()).toEqual(['subtronics', 'tape-b']);
    expect(saved.seen[edc.id]).toContain('subtronics');
    await act(async () => router.push('/festival/solstice-26'));
    await flush();
    expect(app.getAllByLabelText(/^SUBTRONICS, \d+ percent match, you love their sound, Just added/).length).toBeGreaterThan(0);
  });

  it('a first look is quiet', async () => {
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ subtronics: 'love' }));
    const app = await renderApp('/notifications');
    await flush();
    expect(app.queryByText(/was added to/)).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem('lineupNews.v1'))!).seen[edc.id]).toHaveLength(edc.lineup.length);
  });
});
