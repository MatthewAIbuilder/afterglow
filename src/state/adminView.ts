import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * Whether the support account is looking at the app as everyone sees it
 * (instead of its dashboard). Kept on the phone (AsyncStorage
 * `adminGuestView.v1`), so the choice survives a restart; a pill always
 * leads back to the dashboard.
 */
const KEY = 'adminGuestView.v1';
let guest = false;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setGuestView(on: boolean) {
  guest = on;
  emit();
  AsyncStorage.setItem(KEY, on ? '1' : '0').catch(() => {});
}

/** For tests. */
export function forgetGuestView() {
  guest = false;
  loaded = false;
  emit();
}

export function useGuestView(): { guest: boolean; loaded: boolean } {
  const state = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (loaded ? (guest ? 2 : 1) : 0),
  );
  useEffect(() => {
    if (loaded) return;
    AsyncStorage.getItem(KEY)
      .then((v) => {
        guest = v === '1';
      })
      .catch(() => {})
      .finally(() => {
        loaded = true;
        emit();
      });
  }, []);
  return { guest: state === 2, loaded: state > 0 };
}
