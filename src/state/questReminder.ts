import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'questReminder.v1';

/** Whether you asked for an 8 PM nudge about daily quests (AsyncStorage `questReminder.v1`, off by default). A shared store. */
type State = { on: boolean; loaded: boolean };
let state: State = { on: false, loaded: false };
const listeners = new Set<(s: State) => void>();
let loading: Promise<void> | undefined;

function load() {
  loading ??= AsyncStorage.getItem(KEY)
    .then((raw) => raw === 'true')
    .catch(() => false)
    .then((on) => {
      state = { on: state.loaded ? state.on : on, loaded: true };
      listeners.forEach((l) => l(state));
    });
  return loading;
}

export function setQuestReminder(on: boolean) {
  state = { on, loaded: true };
  AsyncStorage.setItem(KEY, String(on)).catch(() => {});
  listeners.forEach((l) => l(state));
}

/** For tests. */
export function forgetQuestReminder() {
  state = { on: false, loaded: false };
  loading = undefined;
  listeners.clear();
}

export function useQuestReminder(): State {
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
