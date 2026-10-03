import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { cleanBook, type Finished, type QuestBook, type QuestEvent, withEvent } from '../features/quests/daily';

const STORAGE_KEY = 'dailyQuests.v1';

/**
 * Your daily quests, kept on this phone (AsyncStorage `dailyQuests.v1`):
 * today's snapshot, what's done, the days you finished all three and your
 * glow. A shared store (no provider) so anything can count an event
 * (`bumpQuestEvent`) and the tracker, the quest board and the toast all agree.
 */
type State = { book?: QuestBook; loaded: boolean };
let state: State = { loaded: false };
const listeners = new Set<(s: State) => void>();
const finishedListeners = new Set<(f: Finished[]) => void>();
let loading: Promise<void> | undefined;
/** Events counted before the book loaded, added once it has. */
let pending: QuestEvent[] = [];
const emit = () => listeners.forEach((l) => l(state));

function load() {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => (raw ? cleanBook(JSON.parse(raw)) : undefined))
    .catch(() => undefined)
    .then((book) => {
      let next = state.book ?? book;
      // Things counted while it loaded land on the book now.
      if (next && pending.length) {
        for (const e of pending) next = withEvent(next, e);
        pending = [];
        void save(next);
      }
      state = { book: next, loaded: true };
      emit();
    });
  return loading;
}

const save = (book: QuestBook) => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(book)).catch(() => {});

/** The tracker writes the book back after a day turns over or a quest is done. */
export function setQuestBook(book: QuestBook) {
  let next = book;
  for (const e of pending) next = withEvent(next, e);
  pending = [];
  if (next === state.book) return;
  state = { ...state, book: next };
  void save(next);
  emit();
}

/** Something a quest counts just happened (opened the map, shared, …). */
export function bumpQuestEvent(event: QuestEvent) {
  if (!state.book) {
    pending.push(event);
    return;
  }
  state = { ...state, book: withEvent(state.book, event) };
  void save(state.book!);
  emit();
}

/** Tell whoever is listening (the toast) what was just finished. */
export function announceFinished(finished: Finished[]) {
  if (finished.length) finishedListeners.forEach((l) => l(finished));
}

export function onQuestsFinished(listener: (f: Finished[]) => void) {
  finishedListeners.add(listener);
  return () => {
    finishedListeners.delete(listener);
  };
}

/** For tests. */
export function forgetDailyQuests() {
  state = { loaded: false };
  loading = undefined;
  pending = [];
  listeners.clear();
  finishedListeners.clear();
}

export function useQuestBook(): State {
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
