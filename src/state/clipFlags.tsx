import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cleanFlags, withFlag, type ClipFlags, type FlagReason } from '../features/discover/flags';

/**
 * Clips you flagged as wrong (clipFlags.v1, this phone only). They're left
 * out of the catalogue the app shows (CatalogProvider reads this), so they
 * vanish from Discover, artist pages and Your clips at once. Not taste:
 * a wrong video says nothing about the artist. Sits outside CatalogProvider.
 */
type Ctx = {
  flags: ClipFlags;
  hidden: ReadonlySet<string>;
  flag: (clipId: string, reason: FlagReason) => void;
  unflag: (clipId: string) => void;
};

const STORAGE_KEY = 'clipFlags.v1';
const NONE: ReadonlySet<string> = new Set();

const ClipFlagsContext = createContext<Ctx>({ flags: {}, hidden: NONE, flag: () => {}, unflag: () => {} });

export function ClipFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<ClipFlags>({});
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setFlags((current) => ({ ...cleanFlags(JSON.parse(raw)), ...current }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(flags)).catch(() => {});
  }, [flags]);

  const flag = useCallback((clipId: string, reason: FlagReason) => setFlags((f) => withFlag(f, clipId, reason, Date.now())), []);
  const unflag = useCallback(
    (clipId: string) =>
      setFlags((f) => {
        if (!f[clipId]) return f;
        const next = { ...f };
        delete next[clipId];
        return next;
      }),
    [],
  );
  const hidden = useMemo(() => (Object.keys(flags).length ? new Set(Object.keys(flags)) : NONE), [flags]);
  const value = useMemo<Ctx>(() => ({ flags, hidden, flag, unflag }), [flags, hidden, flag, unflag]);
  return <ClipFlagsContext.Provider value={value}>{children}</ClipFlagsContext.Provider>;
}

export function useClipFlags() {
  return useContext(ClipFlagsContext);
}
