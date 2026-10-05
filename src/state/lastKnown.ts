import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { cleanLastKnown, forgetAccount, keep, type AccountKept, type LastKnownBook } from '../features/offline/lastKnown';

export const LAST_KNOWN_KEY = 'lastKnown.v1';

/**
 * What this phone last read about people, per account (AsyncStorage
 * `lastKnown.v1`; see features/offline/lastKnown.ts): your profile, crews,
 * crewmates, their stars, check-ins, meeting spots and chats, so they still
 * show with no signal. A shared store: the social, crew and chat providers
 * fill it as they read, and fall back to it when a read doesn't get through.
 * After a read of the phone's copy that failed, what's kept stays in memory
 * and nothing is saved over what's there.
 */
let book: LastKnownBook | undefined;
let writable = false;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(LAST_KNOWN_KEY)
    .then((raw) => {
      writable = true;
      try {
        return raw ? cleanLastKnown(JSON.parse(raw), Date.now()) : {};
      } catch {
        return {};
      }
    })
    .catch(() => ({}) as LastKnownBook)
    .then((read) => {
      // Anything kept while this loaded wins over the older copy.
      let merged = read;
      for (const [uid, acct] of Object.entries(book ?? {})) merged = keep(merged, uid, acct);
      book = merged;
      emit();
    });
  return loading;
}

// Saves that come together (a chat and its crew read at once) are written once.
let queued = false;
const save = () => {
  if (queued) return;
  queued = true;
  void Promise.resolve().then(() => {
    queued = false;
    if (writable && book) AsyncStorage.setItem(LAST_KNOWN_KEY, JSON.stringify(book)).catch(() => {});
  });
};

/** Keep something just read from the server for an account. */
export function rememberLastKnown(uid: string, patch: AccountKept) {
  book = keep(book ?? {}, uid, patch);
  emit();
  if (loading) void loading.then(save);
  else void load().then(save);
}

/** Everything kept for an account, once the phone's copy is read. */
export async function lastKnownFor(uid: string): Promise<AccountKept | undefined> {
  await load();
  return book?.[uid];
}

/** Forget an account's kept reads (it was deleted). */
export function forgetLastKnownAccount(uid: string) {
  if (!book) return;
  book = forgetAccount(book, uid);
  emit();
  save();
}

/** For tests: forget what's loaded. */
export function forgetLastKnown() {
  book = undefined;
  writable = false;
  queued = false;
  loading = undefined;
  listeners.clear();
}

/** An account's kept reads (undefined until the phone's copy is read, or signed out). */
export function useLastKnown(uid: string | undefined): AccountKept | undefined {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    void load().then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return uid ? book?.[uid] : undefined;
}
