import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'collectionSeen.v1';
/** At most this many remembered per account (every set together is far fewer). */
const MAX = 600;

/**
 * What you've already seen in Your collection ("set:key"), per account
 * ('guest' when signed out), kept on this phone: anything you have that
 * isn't in here wears a New tag until you've looked. None saved yet means
 * you haven't opened it since this arrived (what you have then isn't new).
 */
let byAccount: Record<string, string[]> | undefined;
const listeners = new Set<() => void>();
let loading: Promise<void> | undefined;

const clean = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length <= 120))].slice(-MAX) : []);

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      const o = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const out: Record<string, string[]> = {};
      if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (k.length <= 128) out[k] = clean(v);
      return out;
    })
    .catch(() => ({}))
    .then((read) => {
      byAccount ??= read;
      listeners.forEach((l) => l());
    });
  return loading;
}

export function setCollectionSeen(account: string, list: readonly string[]) {
  // Not read yet: wait, so what's saved for other accounts isn't written over.
  if (!byAccount) {
    void load().then(() => setCollectionSeen(account, list));
    return;
  }
  byAccount = { ...byAccount, [account]: clean(list) };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(byAccount)).catch(() => {});
}

/** For tests and account switches: forget what's loaded. */
export function forgetCollectionSeen() {
  byAccount = undefined;
  loading = undefined;
  listeners.clear();
}

/** What an account has seen in Your collection (undefined when nothing saved yet), and a way to save it. */
export function useCollectionSeen(account: string): { seen: string[] | undefined; ready: boolean; save: (list: readonly string[]) => void } {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    void load().then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const save = useCallback((list: readonly string[]) => setCollectionSeen(account, list), [account]);
  return { seen: byAccount?.[account], ready: !!byAccount, save };
}
