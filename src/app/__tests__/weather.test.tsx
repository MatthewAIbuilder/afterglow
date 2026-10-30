import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp } from './appRoutes';

/** Festival weather on the festival page, from a (stubbed) Open-Meteo answer. */
const flush = async (n = 12) => {
  for (let i = 0; i < n; i++)
    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });
};

const days = ['2026-11-06', '2026-11-07', '2026-11-08'];
const hours = days.flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
const answer = {
  daily: { time: days, temperature_2m_max: [91, 84, 80], temperature_2m_min: [73, 70, 66], precipitation_probability_max: [10, 60, 5], uv_index_max: [7, 6, 6], sunset: days.map((d) => `${d}T17:35`) },
  hourly: {
    time: hours,
    temperature_2m: hours.map(() => 80),
    apparent_temperature: hours.map((h) => (h === '2026-11-06T15:00' ? 99 : 80)),
    precipitation_probability: hours.map(() => 0),
    uv_index: hours.map(() => 4),
  },
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

afterEach(() => {
  jest.useRealTimers();
  delete (globalThis as { fetch?: unknown }).fetch;
});

describe('festival weather', () => {
  it('shows the forecast for the festival’s days on its Info tab, with what to bring', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 30, 12) });
    const fetch = jest.fn(async () => ({ ok: true, json: async () => answer }));
    (globalThis as { fetch?: unknown }).fetch = fetch;
    const app = await renderApp('/festival/edc-orlando-26');
    await flush();
    await fireEvent.press(app.getByText('Info'));
    await flush();
    expect(String((fetch.mock.calls[0] as unknown[])[0])).toContain('api.open-meteo.com/v1/forecast?latitude=28.5370&longitude=-81.4040');
    expect(app.getByText('Weather')).toBeTruthy();
    expect(app.getByText(/Feels like 99°[FC] around 3:00 PM\. Water every 20 minutes/)).toBeTruthy();
    expect(app.getByText('A 60% chance of rain. Pack a poncho.')).toBeTruthy();
    expect(app.getByText('Weather by Open-Meteo')).toBeTruthy();
    // Kept on the phone for no signal.
    expect(Object.keys(JSON.parse((await AsyncStorage.getItem('weather.v1')) ?? '{}'))).toEqual(['edc-orlando-26']);
    await app.unmount();
  });
});
