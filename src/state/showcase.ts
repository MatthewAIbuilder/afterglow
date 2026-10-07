import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { cleanShowcase } from '../features/sprouts/showcase';

const STORAGE_KEY = 'showcase.v1';

/**
 * The collectibles you pin to your profile (features/sprouts/showcase.ts),
 * per account ('guest' when signed out), kept on this phone and published
 * with your garden. A shared store, so the sheet and the profile agree at once.
 */
let byAccount: Record<string, string[]> | undefined;
const listeners = new Set<() => void>();
let loading: Promise<void> | undefined;

function cleanAll(raw: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (k.length <= 128) out[k] = cleanShowcase(v);
  return out;
}

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => cleanAll(raw ? JSON.parse(raw) : {}))
    .catch(() => ({}))
    .then((read) => {
      byAccount ??= read;
      listeners.forEach((l) => l());
    });
  return loading;
}

/** Save an account's showcase. */
export function setShowcase(account: string, list: readonly string[]) {
  // Not read yet: wait, so what's saved for other accounts isn't written over.
  if (!byAccount) {
    void load().then(() => setShowcase(account, list));
    return;
  }
  byAccount = { ...(byAccount ?? {}), [account]: cleanShowcase(list) };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(byAccount)).catch(() => {});
}

/** For tests and account switches: forget what's loaded. */
export function forgetShowcase() {
  byAccount = undefined;
  loading = undefined;
  listeners.clear();
}

/** An account's pinned collectibles (artist ids, in order), and a way to save them. */
export function useShowcase(account: string): { pinned: string[]; ready: boolean; save: (list: readonly string[]) => void } {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    void load().then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const save = useCallback((list: readonly string[]) => setShowcase(account, list), [account]);
  return { pinned: byAccount?.[account] ?? NONE, ready: !!byAccount, save };
}

const NONE: string[] = [];
