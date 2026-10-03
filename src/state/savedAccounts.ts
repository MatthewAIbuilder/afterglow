import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { cleanSaved, type SavedAccount, withAccount, withoutAccount } from '../features/accounts/saved';
import { forgetPassword } from '../features/accounts/vault';

const STORAGE_KEY = 'savedAccounts.v1';

/**
 * Accounts saved on this phone for quick switching (names and emails only;
 * passwords live in the keychain). A shared store, so the switcher and the
 * account that refreshes its own details agree.
 */
let list: SavedAccount[] | undefined;
const listeners = new Set<(l: SavedAccount[]) => void>();
let loading: Promise<SavedAccount[]> | undefined;

function set(next: SavedAccount[]) {
  if (next === list) return;
  list = next;
  listeners.forEach((l) => l(next));
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

export function loadSavedAccounts(): Promise<SavedAccount[]> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => cleanSaved(raw ? JSON.parse(raw) : []))
    .catch(() => [] as SavedAccount[])
    .then((read) => {
      // Anything saved while loading wins.
      list ??= read;
      listeners.forEach((l) => l(list!));
      return list;
    });
  // Always the latest list, not the one first read.
  return loading.then(() => list!);
}

export async function rememberAccount(a: SavedAccount) {
  set(withAccount(await loadSavedAccounts(), a));
}

/** Takes an account off the list and forgets its password. */
export async function forgetAccount(uid: string) {
  set(withoutAccount(await loadSavedAccounts(), uid));
  await forgetPassword(uid);
}

/** For tests: forget what's loaded. */
export function forgetSavedAccounts() {
  list = undefined;
  loading = undefined;
  listeners.clear();
}

/** The saved accounts, or undefined while loading. */
export function useSavedAccounts(): SavedAccount[] | undefined {
  const [l, setL] = useState<SavedAccount[] | undefined>(list);
  useEffect(() => {
    listeners.add(setL);
    void loadSavedAccounts().then(setL);
    return () => {
      listeners.delete(setL);
    };
  }, []);
  return l;
}
