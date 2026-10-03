import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { cleanQuestLog, type QuestDone, type QuestId, type QuestProgress } from '../features/quests/quests';

const STORAGE_KEY = 'quests.v1';

/**
 * Side quests you've done (when, and at which festival), kept on this phone
 * so a quest stays done after what earned it is gone (friend scans are only
 * kept a few days). Shared by the tracker and Profile.
 */
type State = { log: Record<string, QuestDone>; progress: Partial<Record<QuestId, QuestProgress>>; loaded: boolean };
let state: State = { log: {}, progress: {}, loaded: false };
const listeners = new Set<(s: State) => void>();
let loading: Promise<void> | undefined;
const emit = () => listeners.forEach((l) => l(state));

function load() {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => (raw ? cleanQuestLog(JSON.parse(raw)) : {}))
    .catch(() => ({}))
    .then((log) => {
      state = { ...state, log: { ...log, ...state.log }, loaded: true };
      emit();
    });
  return loading;
}

/** Record quests just done. */
export function recordQuests(done: [QuestId, QuestDone][]) {
  if (!done.length) return;
  const log = { ...state.log };
  for (const [id, d] of done) log[id] ??= d;
  state = { ...state, log };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(log)).catch(() => {});
  emit();
}

/** The latest progress, for Profile's Side quests row. */
export function setQuestProgress(progress: Partial<Record<QuestId, QuestProgress>>) {
  state = { ...state, progress };
  emit();
}

/** For tests. */
export function forgetQuests() {
  state = { log: {}, progress: {}, loaded: false };
  loading = undefined;
  listeners.clear();
}

export function useQuests(): State {
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
