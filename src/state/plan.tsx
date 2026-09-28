import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Artists you have marked as a must-see. A planning preference only: it puts
 * them first in your festival plan and wins clashes, but it is kept apart from
 * reactions so it never teaches the taste engine anything.
 */
type Ctx = {
  mustSees: ReadonlySet<string>;
  isMustSee: (artistId: string) => boolean;
  toggleMustSee: (artistId: string) => void;
};

const STORAGE_KEY = 'mustSees.v1';

const PlanContext = createContext<Ctx | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setIds((current) => [...new Set([...JSON.parse(raw), ...current])]);
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids)).catch(() => {});
  }, [ids]);

  const toggleMustSee = useCallback((id: string) => {
    setIds((all) => (all.includes(id) ? all.filter((x) => x !== id) : [...all, id]));
  }, []);

  const value = useMemo<Ctx>(() => {
    const mustSees = new Set(ids);
    return { mustSees, isMustSee: (id) => mustSees.has(id), toggleMustSee };
  }, [ids, toggleMustSee]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used inside PlanProvider');
  return ctx;
}
