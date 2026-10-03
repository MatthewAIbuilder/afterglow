import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'careTip.v1';

/**
 * The tip that holding the camera button opens Look after yourself: shown
 * until you've done it once. Shared by every place that shows it (Discover's
 * header, festival mode's camera button), so doing it anywhere hides it
 * everywhere.
 */
let done: boolean | undefined;
const listeners = new Set<(v: boolean) => void>();
let loading: Promise<void> | undefined;

function load() {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => raw === '1')
    .catch(() => false)
    .then((v) => {
      // Done while loading wins.
      done = done || v;
      listeners.forEach((l) => l(done!));
    });
  return loading;
}

/** Holding the camera opened Look after yourself: the tip is done for good. */
export function markCareTipDone() {
  if (done) return;
  done = true;
  listeners.forEach((l) => l(true));
  AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {});
}

/** For tests: forget what's loaded. */
export function forgetCareTip() {
  done = undefined;
  loading = undefined;
  listeners.clear();
}

/** True once loaded and you haven't held the camera yet. */
export function useCareTip(): boolean | undefined {
  const [isDone, setDone] = useState<boolean | undefined>(done);
  useEffect(() => {
    listeners.add(setDone);
    void load();
    return () => {
      listeners.delete(setDone);
    };
  }, []);
  // Undefined while loading, so nothing shows a tip it might not need.
  return isDone === undefined ? undefined : !isDone;
}
