import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { cleanFound, type SecretId } from '../features/secrets/secrets';

const STORAGE_KEY = 'secrets.v1';

/**
 * Secrets you've found, and when (AsyncStorage `secrets.v1`, this phone
 * only). `revealSecret` plays its moment every time, and marks it found the
 * first time. A shared store, so any screen can reveal one.
 */
type State = { found: Partial<Record<SecretId, number>>; loaded: boolean };
let state: State = { found: {}, loaded: false };
const listeners = new Set<(s: State) => void>();
const stageListeners = new Set<(id: SecretId, first: boolean) => void>();
let loading: Promise<void> | undefined;
/** What's saved was read (or there was nothing): saving is safe. Never after a read that failed. */
let writable = false;
const emit = () => listeners.forEach((l) => l(state));

function load() {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      writable = true;
      try {
        return raw ? cleanFound(JSON.parse(raw)) : {};
      } catch {
        return {};
      }
    })
    .catch(() => ({}))
    .then((found) => {
      state = { found: { ...found, ...state.found }, loaded: true };
      emit();
    });
  return loading;
}

/** Play a secret's moment; the first time, it's found for good. */
export function revealSecret(id: SecretId, now = Date.now()) {
  void load().then(() => {
    const first = !state.found[id];
    if (first) {
      state = { ...state, found: { ...state.found, [id]: now } };
      if (writable) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.found)).catch(() => {});
      emit();
    }
    stageListeners.forEach((l) => l(id, first));
  });
}

/** The stage (root layout) listens to play each moment. */
export function onSecret(listener: (id: SecretId, first: boolean) => void) {
  stageListeners.add(listener);
  return () => {
    stageListeners.delete(listener);
  };
}

/** For tests. */
export function forgetSecrets() {
  state = { found: {}, loaded: false };
  loading = undefined;
  writable = false;
  listeners.clear();
  stageListeners.clear();
}

export function useSecrets(): State {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    void load();
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}
