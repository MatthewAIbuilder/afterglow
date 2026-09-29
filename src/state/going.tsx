import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cleanGoing, toggleGoing } from '../features/festivals/going';

/** The festivals you're going to, saved on the device. Planning only: never fed to the taste engine. */
type Ctx = {
  going: readonly string[];
  isGoing: (festivalId: string) => boolean;
  toggle: (festivalId: string) => void;
};

const STORAGE_KEY = 'going.v1';

const GoingContext = createContext<Ctx | null>(null);

export function GoingProvider({ children }: { children: ReactNode }) {
  const [going, setGoing] = useState<string[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setGoing((current) => cleanGoing([...JSON.parse(raw), ...current]));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(going)).catch(() => {});
  }, [going]);

  const toggle = useCallback((festivalId: string) => setGoing((g) => toggleGoing(g, festivalId)), []);
  const value = useMemo<Ctx>(() => ({ going, isGoing: (id) => going.includes(id), toggle }), [going, toggle]);
  return <GoingContext.Provider value={value}>{children}</GoingContext.Provider>;
}

export function useGoing() {
  const ctx = useContext(GoingContext);
  if (!ctx) throw new Error('useGoing must be used inside GoingProvider');
  return ctx;
}
