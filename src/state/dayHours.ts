import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { cleanHours, type DayHours, type FestivalHours } from '../features/plan/hours';

const STORAGE_KEY = 'dayHours.v1';

/**
 * Your hours at each festival, by day: when you arrive, leave and take
 * breaks. Kept only on this phone. Planning state: it bounds your full-day
 * route and never feeds your taste. A shared store, so the editor, the route,
 * Tonight and set reminders agree at once.
 */
type All = Record<string, FestivalHours>;
let all: All | undefined;
const listeners = new Set<() => void>();
let loading: Promise<void> | undefined;

const clean = (raw: unknown): All => {
  const out: All = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [festivalId, days] of Object.entries(raw as Record<string, unknown>)) {
    if (!days || typeof days !== 'object') continue;
    const kept: FestivalHours = {};
    for (const [day, h] of Object.entries(days as Record<string, unknown>)) {
      const c = cleanHours(h);
      if (c) kept[day] = c;
    }
    if (Object.keys(kept).length) out[festivalId] = kept;
  }
  return out;
};

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => clean(raw ? JSON.parse(raw) : {}))
    .catch(() => ({}))
    .then((read) => {
      all ??= read;
      listeners.forEach((l) => l());
    });
  return loading;
}

/** Set (or, with undefined or nothing in it, clear back to all day) your hours for one festival day. */
export function setDayHours(festivalId: string, day: string, hours: DayHours | undefined) {
  const current = all ?? {};
  const c = cleanHours(hours);
  const days = { ...(current[festivalId] ?? {}) };
  if (c) days[day] = c;
  else delete days[day];
  const next = { ...current };
  if (Object.keys(days).length) next[festivalId] = days;
  else delete next[festivalId];
  all = next;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all)).catch(() => {});
}

/** For tests: forget what's loaded. */
export function forgetDayHours() {
  all = undefined;
  loading = undefined;
  listeners.clear();
}

function useStore() {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    void load().then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
}

const NONE: FestivalHours = {};
const NOTHING: All = {};

/** Your hours at one festival (by day; empty is all day every day), and a way to change a day's. */
export function useDayHours(festivalId: string): { hours: FestivalHours; ready: boolean; set: (day: string, hours: DayHours | undefined) => void } {
  useStore();
  const set = useCallback((day: string, hours: DayHours | undefined) => setDayHours(festivalId, day, hours), [festivalId]);
  return { hours: all?.[festivalId] ?? NONE, ready: !!all, set };
}

/** Your hours at every festival, by festival id (for set reminders). */
export function useAllDayHours(): { all: Record<string, FestivalHours>; ready: boolean } {
  useStore();
  return { all: all ?? NOTHING, ready: !!all };
}
