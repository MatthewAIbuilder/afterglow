import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'closeFriends.v1';
/** At most this many close friends. */
export const CLOSE_FRIENDS_MAX = 30;

/**
 * Your close friends, per account, kept only on this phone: nobody else ever
 * sees who's on the list, and they're never told. A shared store, so the
 * profile's star and the Friends tab agree at once.
 */
let byAccount: Record<string, string[]> | undefined;
const listeners = new Set<() => void>();
let loading: Promise<void> | undefined;

const clean = (raw: unknown): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [uid, ids] of Object.entries(raw as Record<string, unknown>))
    if (Array.isArray(ids)) out[uid] = [...new Set(ids.filter((x): x is string => typeof x === 'string' && !!x))].slice(0, CLOSE_FRIENDS_MAX);
  return out;
};

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => clean(raw ? JSON.parse(raw) : {}))
    .catch(() => ({}))
    .then((read) => {
      byAccount ??= read;
      listeners.forEach((l) => l());
    });
  return loading;
}

/** Add or take someone off an account's list (newest first). False when the list is full. */
export function setCloseFriend(me: string, uid: string, on: boolean): boolean {
  const all = byAccount ?? {};
  const list = all[me] ?? [];
  if (on && list.includes(uid)) return true;
  if (on && list.length >= CLOSE_FRIENDS_MAX) return false;
  const next = on ? [uid, ...list] : list.filter((x) => x !== uid);
  if (!on && next.length === list.length) return true;
  byAccount = { ...all, [me]: next };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(byAccount)).catch(() => {});
  return true;
}

/** For tests: forget what's loaded. */
export function forgetCloseFriends() {
  byAccount = undefined;
  loading = undefined;
  listeners.clear();
}

/** An account's close friends (newest first), and a way to change them. Empty signed out. */
export function useCloseFriends(me: string | undefined): { ids: string[]; ready: boolean; set: (uid: string, on: boolean) => boolean } {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    void load().then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const set = useCallback((uid: string, on: boolean) => (me ? setCloseFriend(me, uid, on) : false), [me]);
  return { ids: me ? (byAccount?.[me] ?? []) : [], ready: !!byAccount, set };
}
