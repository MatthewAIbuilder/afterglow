import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
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
    expect(app.getByText('Find your sound faster')).toBeTruthy();
    expect(app.getByText('Play This or that')).toBeTruthy();
    // The top sound is open; the others open on a tap.
    expect(app.getAllByText('Listen for')).toHaveLength(1);
    await fireEvent.press(app.getAllByLabelText(/^How .+ sounds, and how it differs$/)[0]);
    expect(app.getAllByText('Listen for')).toHaveLength(2);
    // Every other sound opens in place.
    await fireEvent.press(app.getByLabelText(/^Rock: /));
    expect(app.getByText('Distorted guitar riffs')).toBeTruthy();
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
  });
});
