import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * What the user did with each clip. This is the raw signal the taste engine
 * learns from. Saved on the device, so your taste survives restarts.
 */
export type Reaction = { liked: boolean; saved: boolean; skipped: boolean };

const EMPTY: Reaction = { liked: false, saved: false, skipped: false };

type Ctx = {
  reactions: Record<string, Reaction>;
  get: (clipId: string) => Reaction;
  setLiked: (clipId: string, liked: boolean) => void;
  toggleSaved: (clipId: string) => void;
  markSkipped: (clipId: string) => void;
};

const STORAGE_KEY = 'reactions.v1';

const ReactionsContext = createContext<Ctx | null>(null);

export function ReactionsProvider({ children }: { children: ReactNode }) {
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setReactions((current) => ({ ...JSON.parse(raw), ...current }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reactions)).catch(() => {});
  }, [reactions]);

  const update = useCallback((clipId: string, fn: (r: Reaction) => Reaction) => {
    setReactions((all) => ({ ...all, [clipId]: fn(all[clipId] ?? EMPTY) }));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      reactions,
      get: (id) => reactions[id] ?? EMPTY,
      setLiked: (id, liked) => update(id, (r) => ({ ...r, liked, skipped: liked ? false : r.skipped })),
      toggleSaved: (id) => update(id, (r) => ({ ...r, saved: !r.saved })),
      markSkipped: (id) => update(id, (r) => ({ ...r, skipped: true, liked: false })),
    }),
    [reactions, update],
  );

  return <ReactionsContext.Provider value={value}>{children}</ReactionsContext.Provider>;
}

export function useReactions() {
  const ctx = useContext(ReactionsContext);
  if (!ctx) throw new Error('useReactions must be used inside ReactionsProvider');
  return ctx;
}
