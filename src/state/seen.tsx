import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { markSeen, type SeenHistory } from '../features/recommend/feed';

/**
 * When you last had each clip on screen in Discover, so the feed can hold back
 * what you've just seen. Viewing history only: it never teaches the taste
 * engine anything (watch behaviour does that, through reactions).
 */
type Ctx = {
  seen: SeenHistory;
  /** Saved history has loaded (or failed to), so the feed can be laid out once. */
  hydrated: boolean;
  markSeen: (clipId: string) => void;
};

const STORAGE_KEY = 'seen.v1';

const SeenContext = createContext<Ctx | null>(null);

export function SeenProvider({ children }: { children: ReactNode }) {
  const [seen, setSeen] = useState<SeenHistory>({});
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        const clean: SeenHistory = {};
        for (const [id, at] of Object.entries(parsed)) if (typeof at === 'number' && Number.isFinite(at)) clean[id] = at;
        setSeen((current) => ({ ...clean, ...current }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seen)).catch(() => {});
  }, [seen]);

  const mark = useCallback((clipId: string) => setSeen((h) => markSeen(h, clipId, Date.now())), []);

  const value = useMemo<Ctx>(() => ({ seen, hydrated, markSeen: mark }), [seen, hydrated, mark]);
  return <SeenContext.Provider value={value}>{children}</SeenContext.Provider>;
}

export function useSeen() {
  const ctx = useContext(SeenContext);
  if (!ctx) throw new Error('useSeen must be used inside SeenProvider');
  return ctx;
}
