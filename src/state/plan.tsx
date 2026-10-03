import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isMustSee, mustSeesAt, toggleMustSee, type MustSees } from '../features/plan/mustSees';

/**
 * Artists you have starred as a must-see, per festival. A planning preference
 * only: it puts them first in that festival's plan and wins clashes there, but
 * it is kept apart from reactions so it never teaches the taste engine anything.
 */
type Ctx = {
  mustSeesAt: (festivalId: string) => ReadonlySet<string>;
  isMustSee: (festivalId: string, artistId: string) => boolean;
  toggleMustSee: (festivalId: string, artistId: string) => void;
  /** Every star at every festival (daily quests count them). */
  starCount: number;
  /** Saved stars have loaded (or failed to). */
  hydrated: boolean;
};

// v1 stored stars per artist for every festival. Those can't be assigned to a festival, so they are dropped.
const STORAGE_KEY = 'mustSees.v2';
const OLD_KEY = 'mustSees.v1';

const PlanContext = createContext<Ctx | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [all, setAll] = useState<MustSees>({});
  const loaded = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.removeItem(OLD_KEY).catch(() => {});
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setAll((current) => ({ ...JSON.parse(raw), ...current }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all)).catch(() => {});
  }, [all]);

  const toggle = useCallback((festivalId: string, artistId: string) => {
    setAll((current) => toggleMustSee(current, festivalId, artistId));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      mustSeesAt: (festivalId) => mustSeesAt(all, festivalId),
      isMustSee: (festivalId, artistId) => isMustSee(all, festivalId, artistId),
      toggleMustSee: toggle,
      starCount: Object.values(all).reduce((n, ids) => n + (Array.isArray(ids) ? ids.length : 0), 0),
      hydrated,
    }),
    [all, toggle, hydrated],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used inside PlanProvider');
  return ctx;
}
