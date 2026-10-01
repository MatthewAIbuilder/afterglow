import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Whether Discover plays the next clip by itself once you've watched one to
 * the end (autoplay.v1, this phone only; on unless you switch it off in
 * What to discover).
 */
type Ctx = { enabled: boolean; setEnabled: (on: boolean) => void };

const STORAGE_KEY = 'autoplay.v1';

const AutoplayContext = createContext<Ctx>({ enabled: true, setEnabled: () => {} });

export function AutoplayProvider({ children }: { children: ReactNode }) {
  const [enabled, setOn] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw === 'false') setOn(false);
      })
      .catch(() => {});
  }, []);
  const setEnabled = useCallback((on: boolean) => {
    setOn(on);
    AsyncStorage.setItem(STORAGE_KEY, on ? 'true' : 'false').catch(() => {});
  }, []);
  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);
  return <AutoplayContext.Provider value={value}>{children}</AutoplayContext.Provider>;
}

export function useAutoplay() {
  return useContext(AutoplayContext);
}
