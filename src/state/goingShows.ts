import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { Show } from '../data/models';
import { cleanGoingShows, withGoingShow, type GoingShow } from '../features/festivals/goingShows';

const STORAGE_KEY = 'goingShows.v1';

/**
 * One-night shows you're going to, kept on this phone (per account, like
 * festivals). A copy of each show is kept, so it's still in your plans after
 * the nightly list lets it go. Planning state: never feeds your taste. A
 * shared store, so the show page, your profile and what it publishes agree.
 */
let list: GoingShow[] | undefined;
const listeners = new Set<() => void>();
let loading: Promise<void> | undefined;

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => cleanGoingShows(raw ? JSON.parse(raw) : []))
    .catch(() => [] as GoingShow[])
    .then((read) => {
      list ??= read;
      listeners.forEach((l) => l());
    });
  return loading;
}

/** Going to a show, or not any more. */
export function setGoingShow(show: Show, on: boolean) {
  list = withGoingShow(list ?? [], show, on);
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)).catch(() => {});
}

/** For tests and a switch of account: forget what's loaded. */
export function forgetGoingShows() {
  list = undefined;
  loading = undefined;
}

const NONE: GoingShow[] = [];

export function useGoingShows(): { shows: GoingShow[]; isGoing: (id: string) => boolean; setGoing: (show: Show, on: boolean) => void; ready: boolean } {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    void load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  const shows = list ?? NONE;
  const isGoing = useCallback((id: string) => (list ?? []).some((s) => s.id === id), []);
  return { shows, isGoing, setGoing: setGoingShow, ready: list !== undefined };
}
