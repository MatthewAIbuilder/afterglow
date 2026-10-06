import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { cleanLedger, creditGlow, EMPTY_LEDGER, type GlowLedger } from '../features/quests/accountGlow';

const STORAGE_KEY = 'accountGlow.v1';

/**
 * Each account's glow on this phone (AsyncStorage `accountGlow.v1`, see
 * `features/quests/accountGlow.ts`), so your level stays yours across
 * signing out and in, switching accounts and restarts. A shared store:
 * `ledger` is undefined until read; after a read that failed it stays in
 * memory and nothing is saved over what's there.
 */
let ledger: GlowLedger | undefined;
let writable = false;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      writable = true;
      try {
        return raw ? cleanLedger(JSON.parse(raw)) : EMPTY_LEDGER;
      } catch {
        return EMPTY_LEDGER;
      }
    })
    .catch(() => EMPTY_LEDGER)
    .then((read) => {
      ledger ??= read;
      emit();
    });
  return loading;
}

/** The phone counts `phoneGlow` with `uid` signed in (see `creditGlow`); only once the ledger was read. */
export function creditAccountGlow(uid: string, phoneGlow: number, publishedLevel: number | undefined) {
  if (!ledger) return;
  const next = creditGlow(ledger, uid, phoneGlow, publishedLevel);
  if (next === ledger) return;
  ledger = next;
  emit();
  if (writable) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

/** For tests: forget what's loaded. */
export function forgetAccountGlow() {
  ledger = undefined;
  writable = false;
  loading = undefined;
  listeners.clear();
}

/** The ledger, undefined until read. */
export function useAccountGlow(): GlowLedger | undefined {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    void load().then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return ledger;
}
