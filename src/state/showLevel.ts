import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'showLevel.v1';

/**
 * Whether your glow level shows on your profile for others: on unless you
 * switch it off in Edit profile. Kept on this phone; `LevelSync` publishes
 * or removes it.
 */
let shown: boolean | undefined;
const listeners = new Set<(v: boolean) => void>();
let loading: Promise<void> | undefined;

function load() {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => raw !== '0')
    .catch(() => true)
    .then((v) => {
      // A choice made while loading wins.
      shown ??= v;
      listeners.forEach((l) => l(shown!));
    });
  return loading;
}

export function setShowLevel(on: boolean) {
  shown = on;
  listeners.forEach((l) => l(on));
  AsyncStorage.setItem(STORAGE_KEY, on ? '1' : '0').catch(() => {});
}

/** For tests: forget what's loaded. */
export function forgetShowLevel() {
  shown = undefined;
  loading = undefined;
  listeners.clear();
}

/** Undefined while loading. */
export function useShowLevel(): boolean | undefined {
  const [on, setOn] = useState<boolean | undefined>(shown);
  useEffect(() => {
    listeners.add(setOn);
    void load();
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return on;
}
