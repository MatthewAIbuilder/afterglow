import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Festival } from '../data/models';
import { forWeekend } from '../features/festivals/weekend';

/**
 * Which weekend you're going to, for festivals run over several, saved on the
 * device. Planning only: it narrows the plan, lineup, countdown and reminders
 * to your weekend and never touches your taste.
 */
type Ctx = {
  weekendOf: (festivalId: string) => number | undefined;
  /** Undefined goes back to every weekend. */
  choose: (festivalId: string, weekend: number | undefined) => void;
  /** The festival as it is for you: your weekend's acts and dates. */
  forYou: (festival: Festival) => Festival;
  hydrated: boolean;
};

const STORAGE_KEY = 'weekends.v1';
const WeekendsContext = createContext<Ctx | null>(null);

const clean = (raw: unknown): Record<string, number> =>
  raw && typeof raw === 'object' && !Array.isArray(raw)
    ? Object.fromEntries(
        Object.entries(raw as Record<string, unknown>).filter(
          (e): e is [string, number] => typeof e[1] === 'number' && Number.isInteger(e[1]) && e[1] >= 1,
        ),
      )
    : {};

export function WeekendsProvider({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setChosen((current) => ({ ...clean(JSON.parse(raw)), ...current }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(chosen)).catch(() => {});
  }, [chosen]);

  const choose = useCallback((festivalId: string, weekend: number | undefined) => {
    setChosen((current) => {
      const next = { ...current };
      if (weekend) next[festivalId] = weekend;
      else delete next[festivalId];
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      weekendOf: (id) => chosen[id],
      choose,
      forYou: (f) => forWeekend(f, chosen[f.id]),
      hydrated,
    }),
    [chosen, choose, hydrated],
  );
  return <WeekendsContext.Provider value={value}>{children}</WeekendsContext.Provider>;
}

export function useWeekends() {
  const ctx = useContext(WeekendsContext);
  if (!ctx) throw new Error('useWeekends must be used inside WeekendsProvider');
  return ctx;
}
