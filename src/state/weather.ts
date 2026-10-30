import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import type { Festival } from '../data/models';
import { unitsFor } from '../features/festivals/near';
import { cleanForecast, type Forecast, forecastUrl, parseForecast, STALE_MS, type TempUnit, wantsForecast } from '../features/weather/weather';

/**
 * Festival weather from Open-Meteo, kept on the phone (`weather.v1`, by
 * festival) so it still shows with no signal, and fetched again when it's a
 * few hours old. Only for festivals starting within the forecast.
 */
export const WEATHER_KEY = 'weather.v1';
const TIMEOUT_MS = 8000;

let cache: Record<string, Forecast> | undefined;
let loading: Promise<Record<string, Forecast>> | undefined;
const inFlight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

const locale = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
};
export const tempUnit = (): TempUnit => (unitsFor(locale()) === 'mi' ? 'F' : 'C');

function load(): Promise<Record<string, Forecast>> {
  if (cache) return Promise.resolve(cache);
  loading ??= AsyncStorage.getItem(WEATHER_KEY)
    .then((raw) => {
      const o = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const out: Record<string, Forecast> = {};
      for (const [id, f] of Object.entries(o)) {
        const clean = cleanForecast(f);
        if (clean) out[id] = clean;
      }
      return out;
    })
    .catch(() => ({}))
    .then((c) => {
      cache ??= c;
      loading = undefined;
      return cache;
    });
  return loading;
}

/** Every forecast kept on the phone (the reminders read these). */
export const readForecasts = () => load();

export function forgetWeather() {
  cache = undefined;
  loading = undefined;
  inFlight.clear();
}

async function refresh(festival: Festival, unit: TempUnit): Promise<void> {
  if (!festival.place) return;
  const all = await load();
  const have = all[festival.id];
  if (have && have.unit === unit && Date.now() - have.fetchedAt < STALE_MS) return;
  const running = inFlight.get(festival.id);
  if (running) return running;
  const job = (async () => {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = setTimeout(() => ctrl?.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(forecastUrl(festival.place!, unit), ctrl ? { signal: ctrl.signal } : undefined);
      if (!res.ok) return;
      const forecast = parseForecast(await res.json(), unit, Date.now());
      if (!forecast) return;
      cache = { ...(await load()), [festival.id]: forecast };
      listeners.forEach((l) => l());
      await AsyncStorage.setItem(WEATHER_KEY, JSON.stringify(cache)).catch(() => {});
    } catch {
      // No signal: what's kept stays.
    } finally {
      clearTimeout(timer);
      inFlight.delete(festival.id);
    }
  })();
  inFlight.set(festival.id, job);
  return job;
}

/** The forecast for a festival (kept or fresh), when it's soon enough to have one. */
export function useFestivalWeather(festival: Festival | undefined, today: Date): Forecast | undefined {
  const [, bump] = useState(0);
  const wanted = !!festival && wantsForecast(festival, today);
  const id = festival?.id;
  useEffect(() => {
    if (!wanted || !festival) return;
    let live = true;
    const l = () => live && bump((n) => n + 1);
    listeners.add(l);
    void load().then(l);
    void refresh(festival, tempUnit());
    return () => {
      live = false;
      listeners.delete(l);
    };
    // Only when the festival (or whether it's soon) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, wanted]);
  return wanted && id ? cache?.[id] : undefined;
}
