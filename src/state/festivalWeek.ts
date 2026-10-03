import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { cleanOpened } from '../features/festivalWeek/week';

const STORAGE_KEY = 'festivalWeek.v1';

/**
 * Which festival-week doors you've opened, per festival (this phone only).
 * Shared by the calendar and the cards that point at it, so opening a door
 * anywhere shows everywhere.
 */
let opened: Record<string, number[]> | undefined;
const listeners = new Set<(v: Record<string, number[]>) => void>();
let loading: Promise<void> | undefined;

function load() {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => cleanOpened(raw ? JSON.parse(raw) : {}))
    .catch(() => ({}))
    .then((v) => {
      // Doors opened while loading win.
      const merged = { ...v };
      for (const [k, days] of Object.entries(opened ?? {})) merged[k] = [...new Set([...(merged[k] ?? []), ...days])];
      opened = merged;
      listeners.forEach((l) => l(opened!));
    });
  return loading;
}

/** Open a door (it stays open). */
export function openDoor(festivalId: string, day: number) {
  const now = opened ?? {};
  if (now[festivalId]?.includes(day)) return;
  opened = { ...now, [festivalId]: [...(now[festivalId] ?? []), day] };
  listeners.forEach((l) => l(opened!));
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(opened)).catch(() => {});
}

/** For tests: forget what's loaded. */
export function forgetFestivalWeek() {
  opened = undefined;
  loading = undefined;
  listeners.clear();
}

/** The doors you've opened at a festival. */
export function useOpenedDoors(festivalId: string): ReadonlySet<number> {
  const [all, setAll] = useState<Record<string, number[]>>(opened ?? {});
  useEffect(() => {
    listeners.add(setAll);
    void load();
    return () => {
      listeners.delete(setAll);
    };
  }, []);
  return new Set(all[festivalId] ?? []);
}
