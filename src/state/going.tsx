import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cleanGoing, toggleGoing } from '../features/festivals/going';

/** The festivals you're going to, saved on the device. Planning only: never fed to the taste engine. */
type Ctx = {
  going: readonly string[];
  isGoing: (festivalId: string) => boolean;
  toggle: (festivalId: string) => void;
  /** Saved festivals have loaded (or failed to). */
  hydrated: boolean;
  /** Nothing was ever saved here for this account (a new install or a phone new to it), and nothing picked yet. */
  fresh: boolean;
  /** Bring back festivals from elsewhere (your profile), added to any picked here. */
  restore: (festivalIds: readonly string[]) => void;
};

const STORAGE_KEY = 'going.v1';

const GoingContext = createContext<Ctx | null>(null);

export function GoingProvider({ children }: { children: ReactNode }) {
  const [going, setGoing] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [fresh, setFresh] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setGoing((current) => cleanGoing([...JSON.parse(raw), ...current]));
        else setFresh(true);
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(going)).catch(() => {});
  }, [going]);

  const toggle = useCallback((festivalId: string) => {
    setFresh(false);
    setGoing((g) => toggleGoing(g, festivalId));
  }, []);
  const restore = useCallback((festivalIds: readonly string[]) => {
    setFresh(false);
    setGoing((g) => cleanGoing([...g, ...festivalIds]));
  }, []);
  const value = useMemo<Ctx>(
    () => ({ going, isGoing: (id) => going.includes(id), toggle, hydrated, fresh: fresh && going.length === 0, restore }),
    [going, toggle, hydrated, fresh, restore],
  );
  return <GoingContext.Provider value={value}>{children}</GoingContext.Provider>;
}

export function useGoing() {
  const ctx = useContext(GoingContext);
  if (!ctx) throw new Error('useGoing must be used inside GoingProvider');
  return ctx;
}
