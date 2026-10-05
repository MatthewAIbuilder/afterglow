import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { cleanBook, type Finished, type QuestBook, type QuestEvent, questDay, withEvent } from '../features/quests/daily';

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
/** The saved book was read (or there was none): saving is safe. After a read that failed, this session stays in memory. */
let writable = false;
const emit = () => listeners.forEach((l) => l(state));

function load() {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      writable = true;
      try {
        return raw ? cleanBook(JSON.parse(raw)) : undefined;
      } catch {
        return undefined;
      }
    })
    .catch(() => undefined)
    .then((book) => {
      let next = state.book ?? book;
      // Things counted while it loaded land on the book now, if it's today's (else the tracker's turnover takes them).
      if (next && pending.length && next.day === questDay(Date.now())) {
        for (const e of pending) next = withEvent(next, e);
        pending = [];
        void save(next);
      }
      state = { book: next, loaded: true };
      emit();
    });
  return loading;
}

const save = async (book: QuestBook) => {
  if (!writable) return;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(book)).catch(() => {});
};

/**
 * The tracker's update, worked out from the book as it is now (never a copy
 * from an earlier render, so an event counted in between is kept). Events
 * waiting for today's book land on it.
 */
export function updateQuestBook<T>(update: (book: QuestBook | undefined) => { book: QuestBook; extra: T }): T {
  const { book, extra } = update(state.book);
  let next = book;
  if (pending.length && next.day === questDay(Date.now())) {
    for (const e of pending) next = withEvent(next, e);
    pending = [];
  }
  if (next !== state.book) {
    state = { ...state, book: next };
    void save(next);
    emit();
  }
  return extra;
}

/** Something a quest counts just happened (opened the map, shared, …). */
export function bumpQuestEvent(event: QuestEvent) {
  // No book yet, or still yesterday's (the day turned over a moment ago): it waits for today's.
  if (!state.book || state.book.day !== questDay(Date.now())) {
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
  writable = false;
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
