import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderApp } from './appRoutes';

/** My Sound opens on the overview (your sound, a guide to each sound, tips), with the bubble map a toggle away. */
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 4, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('My Sound overview', () => {
  it('explains your sounds, offers ones to try and tips, and switches to the map', async () => {
    const app = await renderApp('/sound');
    await flush();
    expect(app.getByLabelText('Overview').props.accessibilityState).toEqual({ selected: true });
    expect(app.getByText('Where you might start')).toBeTruthy();
    expect(app.getByText('Sounds to try next')).toBeTruthy();
    expect(app.getByText('Every sound')).toBeTruthy();
    // Every sound is a tile in a grid: ten of them, each opening its own page.
    expect(app.getAllByLabelText(/Opens everything about this sound|^.+\. /).length).toBeGreaterThan(5);
    // Tips are folded into one row until you open it.
    expect(app.getByText('Find your sound faster')).toBeTruthy();
    expect(app.queryByText('Play This or that')).toBeNull();
    await fireEvent.press(app.getByText('Find your sound faster'));
    expect(app.getByText('Play This or that')).toBeTruthy();
    // Tap a sound: its own page, with all of it.
    await fireEvent.press(app.getByLabelText(/^Rock, |^Rock\. /));
    await flush();
    expect(app.getByText('Listen for')).toBeTruthy();
    expect(app.getByText('Distorted guitar riffs')).toBeTruthy();
    expect(app.getByText('How it differs')).toBeTruthy();
    expect(app.getByText('Your best matches')).toBeTruthy();
    await act(async () => router.back());
    await flush();
    // The map is a toggle away.
    await fireEvent.press(app.getByLabelText('Bubble map'));
    await flush();
    expect(app.getByLabelText('Bubble map').props.accessibilityState).toEqual({ selected: true });
    expect(app.getByLabelText('Search your map for an artist or a sound')).toBeTruthy();
    expect(app.queryByText('Find your sound faster')).toBeNull();
  });

  it('a festival opens straight on the map', async () => {
    const app = await renderApp('/sound?festival=edc-orlando-26');
    await flush();
    expect(app.getByLabelText('Bubble map').props.accessibilityState).toEqual({ selected: true });
    expect(app.getAllByLabelText(/^Your sound at /).length).toBeGreaterThan(0);
    // The overview is about you across everyone, not the festival the map shows.
    await fireEvent.press(app.getByLabelText('Overview'));
    await flush();
    expect(app.queryByLabelText(/^Your sound at /)).toBeNull();
    expect(app.getByLabelText(/^Your sound: /)).toBeTruthy();
  });

  it('a quest or your profile can open the map while the overview is showing', async () => {
    const app = await renderApp('/sound');
    await flush();
    expect(app.getByLabelText('Overview').props.accessibilityState).toEqual({ selected: true });
    await act(async () => router.navigate({ pathname: '/sound', params: { view: 'map' } }));
    await flush();
    expect(app.getByLabelText('Bubble map').props.accessibilityState).toEqual({ selected: true });
  });
});
