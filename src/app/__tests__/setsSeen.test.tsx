import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderApp } from './appRoutes';

/** "How was it?" and Sets you've seen, through the real routes. */
const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('rating a set', () => {
  it('saves how it was, warms up the artist, and lists it in Sets you’ve seen', async () => {
    const app = await renderApp('/profile');
    await settle();
    await act(async () => router.push('/rate-set?festival=solstice-26&artist=subtronics&day=Friday'));
    await settle();
    expect(app.getAllByText('How was SUBTRONICS?').length).toBeGreaterThan(0);
    await fireEvent.press(app.getByLabelText('Unreal: rate the set'));
    await settle();
    const saved = JSON.parse((await AsyncStorage.getItem('setsSeen.v1')) ?? '{}');
    expect(saved.sets['solstice-26:subtronics:Friday']).toEqual(expect.objectContaining({ verdict: 'unreal' }));
    await settle();
    expect(JSON.parse((await AsyncStorage.getItem('artistRatings.v1')) ?? '{}')).toEqual({ subtronics: 'love' });

    await act(async () => router.push('/seen'));
    await settle();
    expect(app.getByText('1 set · 1 artist · 1 festival')).toBeTruthy();
    expect(app.getByLabelText('SUBTRONICS, Unreal, Friday')).toBeTruthy();
    await app.unmount();
  });
});
