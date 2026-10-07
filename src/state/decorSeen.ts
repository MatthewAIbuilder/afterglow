import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { cleanDecor, type DecorId } from '../features/sprouts/decor';

const STORAGE_KEY = 'decorSeen.v1';

/**
 * Garden decorations whose moment you've seen, per account ('guest' when
 * signed out), kept on this phone: a new one gets its celebration once.
 * None saved yet for an account means it hasn't looked since decorations
 * arrived (what it has then is simply there).
 */
let byAccount: Record<string, DecorId[]> | undefined;
const listeners = new Set<() => void>();
let loading: Promise<void> | undefined;

function cleanAll(raw: unknown): Record<string, DecorId[]> {
  const out: Record<string, DecorId[]> = {};
  if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (k.length <= 128) out[k] = cleanDecor(v);
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

export function setDecorSeen(account: string, list: readonly DecorId[]) {
  byAccount = { ...(byAccount ?? {}), [account]: cleanDecor(list) };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(byAccount)).catch(() => {});
}

/** For tests and account switches: forget what's loaded. */
export function forgetDecorSeen() {
  byAccount = undefined;
  loading = undefined;
  listeners.clear();
}

/** Decorations an account has seen celebrated (undefined when none saved yet), and a way to save them. */
export function useDecorSeen(account: string): { seen: DecorId[] | undefined; ready: boolean; save: (list: readonly DecorId[]) => void } {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    void load().then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const save = useCallback((list: readonly DecorId[]) => setDecorSeen(account, list), [account]);
  return { seen: byAccount?.[account], ready: !!byAccount, save };
}
