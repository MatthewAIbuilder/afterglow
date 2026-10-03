import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'questTip.v1';

/**
 * The tip that the ring in Discover's header holds your daily quests: shown
 * until you've opened your quests once.
 * Opening Quests from anywhere hides it.
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

/** You opened your quests: the tip is done for good. */
export function markQuestTipDone() {
  if (done) return;
  done = true;
  listeners.forEach((l) => l(true));
  AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {});
}

/** For tests: forget what's loaded. */
export function forgetQuestTip() {
  done = undefined;
  loading = undefined;
  listeners.clear();
}

/** True once loaded and you haven't opened your quests yet. */
export function useQuestTip(): boolean | undefined {
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
