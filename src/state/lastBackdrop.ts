import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'lastBackdrop.v1';

/**
 * The animated background each account last showed, kept on this phone, so
 * the profile's quick swap can go back to it after showing the cover photo.
 * A shared store.
 */
let byAccount: Record<string, string> | undefined;
const listeners = new Set<() => void>();
let loading: Promise<void> | undefined;

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      const read = raw ? (JSON.parse(raw) as unknown) : {};
      const out: Record<string, string> = {};
      if (read && typeof read === 'object') for (const [uid, id] of Object.entries(read)) if (typeof id === 'string' && id) out[uid] = id;
      return out;
    })
    .catch(() => ({}))
    .then((read) => {
      byAccount ??= read;
      listeners.forEach((l) => l());
    });
  return loading;
}

export function rememberBackdrop(me: string, id: string) {
  if (byAccount?.[me] === id) return;
  byAccount = { ...byAccount, [me]: id };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(byAccount)).catch(() => {});
}

/** For tests: forget what's loaded. */
export function forgetLastBackdrop() {
  byAccount = undefined;
  loading = undefined;
  listeners.clear();
}

/** The background this account last showed, if any. */
export function useLastBackdrop(me: string | undefined): string | undefined {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    void load().then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return me ? byAccount?.[me] : undefined;
}
