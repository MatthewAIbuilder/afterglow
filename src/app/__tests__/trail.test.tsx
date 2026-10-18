import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { readPrefs, readTrails, recordFixes, TRAIL_ACTIVE_KEY, TRAIL_KEY, writeActive } from '../../features/care/trailStore';
import { renderApp } from './appRoutes';

/** The festival trail: asks once on a festival day, records only then, stops by itself, and draws what was walked. */
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 10; i++) await settle();
};
const loc = Location as unknown as Record<string, jest.Mock<(...a: unknown[]) => Promise<unknown>>>;
const NOW = new Date(2026, 10, 7, 16, 0);
const MIN = 60_000;

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  await AsyncStorage.setItem('going.v1', JSON.stringify(['edc-orlando-26']));
  for (const k of ['startLocationUpdatesAsync', 'stopLocationUpdatesAsync', 'hasStartedLocationUpdatesAsync']) loc[k].mockClear();
  loc.getForegroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  loc.getBackgroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  loc.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true });
  loc.requestBackgroundPermissionsAsync.mockResolvedValue({ granted: true });
  loc.hasStartedLocationUpdatesAsync.mockResolvedValue(false);
});

describe('the festival trail', () => {
  it('on a festival day it asks once; yes records until the festival is over', async () => {
    jest.useFakeTimers({ now: NOW });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderApp('/festivals');
    await flush();
    const ask = alert.mock.calls.find((c) => c[0] === 'Keep a trail of your festival day?');
    expect(ask).toBeTruthy();
    expect(loc.startLocationUpdatesAsync).not.toHaveBeenCalled();
    await act(async () => ask![2]!.find((b) => b.text === 'Turn on')?.onPress?.());
    await flush();
    expect((await readPrefs()).mode).toBe('on');
    expect(loc.requestBackgroundPermissionsAsync).toHaveBeenCalled();
    expect(loc.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
    expect(JSON.parse((await AsyncStorage.getItem(TRAIL_ACTIVE_KEY)) ?? '{}')).toEqual({ festivalId: 'edc-orlando-26', until: new Date(2026, 10, 9, 7, 0).getTime() });
  });

  it('“Not now” asks again tomorrow, not today; “Never” never asks', async () => {
    jest.useFakeTimers({ now: NOW });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderApp('/festivals');
    await flush();
    const ask = alert.mock.calls.find((c) => c[0] === 'Keep a trail of your festival day?')!;
    await act(async () => ask[2]!.find((b) => b.text === 'Not now')?.onPress?.());
    await flush();
    alert.mockClear();
    await act(async () => {
      jest.advanceTimersByTime(16 * MIN);
    });
    await flush();
    expect(alert.mock.calls.filter((c) => c[0] === 'Keep a trail of your festival day?')).toHaveLength(0);
    expect(loc.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('on any other day nothing records, even when it’s on', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 1, 16, 0) });
    await AsyncStorage.setItem('trailPrefs.v1', JSON.stringify({ mode: 'on' }));
    await renderApp('/festivals');
    await flush();
    expect(loc.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('records good positions for the festival, and tells the task to stop once it’s over', async () => {
    const until = NOW.getTime() + 60 * MIN;
    await writeActive({ festivalId: 'edc-orlando-26', until });
    expect(await recordFixes([{ at: NOW.getTime(), lat: 28.6, lon: -81.2, accuracy: 8 }, { at: NOW.getTime() + MIN, lat: 28.601, lon: -81.2, accuracy: 8 }], NOW.getTime() + MIN)).toBe('recorded');
    expect((await readTrails())['edc-orlando-26']).toHaveLength(2);
    expect(await recordFixes([{ at: until + MIN, lat: 28.7, lon: -81.2, accuracy: 8 }], until + MIN)).toBe('stop');
    expect((await readTrails())['edc-orlando-26']).toHaveLength(2);
    // Nothing recording at all: stop.
    await writeActive(undefined);
    expect(await recordFixes([{ at: NOW.getTime(), lat: 1, lon: 1 }], NOW.getTime())).toBe('stop');
  });

  it('the trail screen draws what was walked, with the numbers, and deletes it when asked', async () => {
    jest.useFakeTimers({ now: NOW });
    const pts = Array.from({ length: 6 }, (_, i) => [new Date(2026, 10, 6, 15, i * 5).getTime(), 28.6 + i * 0.001, -81.2]);
    await AsyncStorage.setItem(TRAIL_KEY, JSON.stringify({ 'edc-orlando-26': pts }));
    await AsyncStorage.setItem('trailPrefs.v1', JSON.stringify({ mode: 'off' }));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const app = await renderApp('/trail');
    await flush();
    expect(app.getByText('EDC Orlando 2026')).toBeTruthy();
    expect(app.getByLabelText(/^Walked: /)).toBeTruthy();
    expect(app.getByText('Check in with yourself')).toBeTruthy();
    await fireEvent.press(app.getByText('Delete my trail'));
    const del = alert.mock.calls.at(-1)![2]!.find((b) => b.text === 'Delete');
    await act(async () => del?.onPress?.());
    await flush();
    expect(await readTrails()).toEqual({});
    expect(app.getByText('No trail yet')).toBeTruthy();
  });
});
