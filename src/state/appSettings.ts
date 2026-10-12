import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { appSettingsFromDoc, DEFAULT_APP_SETTINGS, type AppSettings } from '../features/social/models';

const STORAGE_KEY = 'appSettings.v1';

/**
 * The app-wide switches set from HQ (`AppSettings`), as this phone last read
 * them: kept, so they hold with no signal, and the defaults until the first
 * read. A shared store: `LivePatchSync` fills it whenever the app opens or
 * comes back to the front.
 */
let settings: AppSettings | undefined;
const listeners = new Set<(s: AppSettings) => void>();
let loading: Promise<void> | undefined;

function load() {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => appSettingsFromDoc(raw ? JSON.parse(raw) : undefined))
    .catch(() => DEFAULT_APP_SETTINGS)
    .then((read) => {
      // A fresh answer from the server while loading wins.
      settings ??= read;
      listeners.forEach((l) => l(settings!));
    });
  return loading;
}

/** What the server says now (replaces what was kept). */
export function setAppSettings(next: AppSettings) {
  if (settings && settings.careGuide === next.careGuide) return;
  settings = next;
  listeners.forEach((l) => l(next));
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

/** For tests: forget what's loaded. */
export function forgetAppSettings() {
  settings = undefined;
  loading = undefined;
  listeners.clear();
}

/** The app-wide switches (the defaults until read). */
export function useAppSettings(): AppSettings {
  const [s, setS] = useState<AppSettings>(settings ?? DEFAULT_APP_SETTINGS);
  useEffect(() => {
    listeners.add(setS);
    void load().then(() => settings && setS(settings));
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}
