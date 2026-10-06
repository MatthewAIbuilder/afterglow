import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { cleanLayouts, type Placement } from '../features/sprouts/gardenLayout';

const STORAGE_KEY = 'gardenLayout.v1';

/**
 * Where each creature stands in your garden, per account ('guest' when
 * signed out), kept only on this phone. A shared store, so the garden reads
 * it at once and a move is saved the moment it lands.
 */
let byAccount: Record<string, Placement> | undefined;
const listeners = new Set<() => void>();
let loading: Promise<void> | undefined;

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => cleanLayouts(raw ? JSON.parse(raw) : {}))
    .catch(() => ({}))
    .then((read) => {
      byAccount ??= read;
      listeners.forEach((l) => l());
    });
  return loading;
}

/** Save an account's layout (every resident and its spot). */
export function setGardenLayout(account: string, placement: Placement) {
  byAccount = { ...(byAccount ?? {}), [account]: { ...placement } };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(byAccount)).catch(() => {});
}

/** For tests: forget what's loaded. */
export function forgetGardenLayout() {
  byAccount = undefined;
  loading = undefined;
  listeners.clear();
}

/** An account's saved layout (undefined until read, or when none was saved), and a way to save one. */
export function useGardenLayout(account: string): { layout: Placement | undefined; ready: boolean; save: (placement: Placement) => void } {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    void load().then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const save = useCallback((placement: Placement) => setGardenLayout(account, placement), [account]);
  return { layout: byAccount?.[account], ready: !!byAccount, save };
}
