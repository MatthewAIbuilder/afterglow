import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderApp } from './appRoutes';
import { builtInCatalog } from '../../state/catalog';

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

describe('following artists', () => {
  it('follow from an artist page, see where they play next, and unfollow', async () => {
    const app = await renderApp('/artist/subtronics');
    await flush();
    expect(app.getByText('Follow to hear when they’re added to a lineup.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Follow SUBTRONICS'));
    await flush();
    expect(app.getByLabelText('Following SUBTRONICS. Tap to unfollow.')).toBeTruthy();
    expect(app.getByText('You’ll hear when they’re added to a lineup.')).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('followedArtists.v1'))!)).toEqual(['subtronics']);

    await act(async () => router.push('/your-artists'));
    await flush();
    expect(app.getByText('1 artist · news when they’re added to a lineup')).toBeTruthy();
    expect(app.getByText('Playing next')).toBeTruthy();
    const next = builtInCatalog.festivalsOf('subtronics').length;
    expect(next).toBeGreaterThan(0);
    expect(app.getByLabelText(/^SUBTRONICS, .+/)).toBeTruthy();
    await fireEvent.press(app.getAllByLabelText('Following SUBTRONICS. Tap to unfollow.').at(-1)!);
    await flush();
    expect(JSON.parse((await AsyncStorage.getItem('followedArtists.v1'))!)).toEqual([]);
  });

  it('the bell says when an artist you follow is added, and the lineup marks them', async () => {
    const solstice = builtInCatalog.festival('solstice-26')!;
    const seen = Object.fromEntries(builtInCatalog.festivals.map((f) => [f.id, f.id === solstice.id ? f.lineup.filter((a) => a !== 'tape-b') : f.lineup]));
    await AsyncStorage.setItem('lineupNews.v1', JSON.stringify({ seen, news: [] }));
    await AsyncStorage.setItem('followedArtists.v1', JSON.stringify(['tape-b']));
    const app = await renderApp('/notifications');
    await flush();
    expect(app.getByText('TAPE B was added to Solstice 2026')).toBeTruthy();
    await act(async () => router.push('/festival/solstice-26'));
    await flush();
    expect(app.getAllByLabelText(/^TAPE B, \d+ percent match, Just added · Following/).length).toBeGreaterThan(0);
  });

  it('Profile opens your artists, with suggestions when you follow no one', async () => {
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ subtronics: 'love' }));
    const app = await renderApp('/profile');
    await flush();
    await fireEvent.press(app.getByLabelText('Your artists, none followed yet'));
    await flush();
    expect(app.getByText('Follow artists to hear when they’re added to a lineup.')).toBeTruthy();
    expect(app.getByText('Artists you’d love')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Follow SUBTRONICS'));
    await flush();
    expect(app.getByText('1 artist · news when they’re added to a lineup')).toBeTruthy();
  });
});
