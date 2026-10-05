import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'scouted.v1';

/**
 * Festivals whose set times you sent and HQ put live, per account, as this
 * phone last read them (so the thanks comes once, and Set scout stays earned
 * without signal). A shared store: `ScoutSync` fills it, badges read it.
 */
let byAccount: Record<string, string[]> | undefined;
const listeners = new Set<() => void>();
let loading: Promise<void> | undefined;

const clean = (raw: unknown): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [uid, ids] of Object.entries(raw as Record<string, unknown>)) if (Array.isArray(ids)) out[uid] = ids.filter((x): x is string => typeof x === 'string').slice(0, 500);
  return out;
};

export function loadScouted(): Promise<void> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => clean(raw ? JSON.parse(raw) : {}))
    .catch(() => ({}))
    .then((read) => {
      byAccount ??= read;
      listeners.forEach((l) => l());
    });
  return loading;
}

/** What the server says is live for an account now; returns the festivals that are newly live. Load first. */
export function setScouted(uid: string, live: readonly string[]): string[] {
  const all = byAccount ?? {};
  // The first look on this phone (a new phone, a reinstall): note what's live without thanking again.
  const first = !(uid in all);
  const before = all[uid] ?? [];
  const fresh = live.filter((id) => !before.includes(id));
  if (!fresh.length && !first) return [];
  byAccount = { ...all, [uid]: [...before, ...fresh] };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(byAccount)).catch(() => {});
  return first ? [] : fresh;
}

/** For tests: forget what's loaded. */
export function forgetScouted() {
  byAccount = undefined;
  loading = undefined;
  listeners.clear();
}

/** The festivals an account's set times went live for (empty until read, or signed out). */
export function useScouted(uid: string | undefined): string[] {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    void loadScouted().then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return uid ? (byAccount?.[uid] ?? []) : [];
}
