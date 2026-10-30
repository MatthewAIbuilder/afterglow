import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { renderApp } from './appRoutes';

/** Find my way back, through the real route: save your car, then the way back to it. */
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

describe('find my way back', () => {
  it('saves where your car is and points you back to it', async () => {
    const L = Location as unknown as Record<string, jest.Mock>;
    L.requestForegroundPermissionsAsync.mockImplementation(async () => ({ granted: true }));
    L.getForegroundPermissionsAsync.mockImplementation(async () => ({ granted: true }));
    L.getCurrentPositionAsync.mockImplementationOnce(async () => ({ coords: { latitude: 28.5, longitude: -81.4, accuracy: 8 } }));
    let report: ((p: { coords: { latitude: number; longitude: number; accuracy: number } }) => void) | undefined;
    L.watchPositionAsync.mockImplementation(async (_o: unknown, cb: typeof report) => {
      report = cb;
      return { remove: jest.fn() };
    });

    const app = await renderApp('/spots');
    await settle();
    expect(app.getByText('Nothing saved yet')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Save my car here'));
    await settle();
    expect(app.getByText('You’re here')).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('spots.v1')) ?? '[]')).toEqual([expect.objectContaining({ id: 'car', kind: 'car', lat: 28.5, lon: -81.4, accuracy: 8 })]);

    // Later, across the festival: the way back.
    await act(async () => report?.({ coords: { latitude: 28.5045, longitude: -81.4, accuracy: 10 } }));
    await settle();
    expect(app.getByText(/^(500 m|0.3 mi) · 7 min walk/)).toBeTruthy();
    expect(app.getByLabelText('Walking directions to My car in Maps')).toBeTruthy();
    await app.unmount();
  });
});
