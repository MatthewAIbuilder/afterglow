import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cleanPrep } from '../features/prep/checklist';

/**
 * What you've ticked on each festival's Get ready list (ticket, travel, what
 * to pack). Saved on the phone (AsyncStorage `prep.v1`); planning only, never
 * fed to the taste engine.
 */
type Ctx = { tickedFor: (festivalId: string) => ReadonlySet<string>; toggle: (festivalId: string, item: string) => void; hydrated: boolean };

const KEY = 'prep.v1';
const EMPTY: ReadonlySet<string> = new Set();
const PrepContext = createContext<Ctx | null>(null);

export function PrepProvider({ children }: { children: ReactNode }) {
  const [ticked, setTicked] = useState<Record<string, string[]>>({});
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setTicked((cur) => ({ ...cleanPrep(JSON.parse(raw)), ...cur }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);
  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(KEY, JSON.stringify(ticked)).catch(() => {});
  }, [ticked]);

  const sets = useMemo(() => Object.fromEntries(Object.entries(ticked).map(([k, v]) => [k, new Set(v)])), [ticked]);
  const tickedFor = useCallback((id: string) => sets[id] ?? EMPTY, [sets]);
  const toggle = useCallback((festivalId: string, item: string) => {
    setTicked((all) => {
      const list = all[festivalId] ?? [];
      return { ...all, [festivalId]: list.includes(item) ? list.filter((x) => x !== item) : [...list, item] };
    });
  }, []);

  const value = useMemo<Ctx>(() => ({ tickedFor, toggle, hydrated }), [tickedFor, toggle, hydrated]);
  return <PrepContext.Provider value={value}>{children}</PrepContext.Provider>;
}

export function usePrepTicks(): Ctx {
  const ctx = useContext(PrepContext);
  if (!ctx) throw new Error('usePrepTicks must be used inside PrepProvider');
  return ctx;
}
