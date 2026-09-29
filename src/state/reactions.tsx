import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { mergeWatch, type Watch } from '../features/taste/watch';

/**
 * What the user did with each clip. This is the raw signal the taste engine
 * learns from. Saved on the device, so your taste survives restarts.
 */
export type Reaction = {
  liked: boolean;
  saved: boolean;
  skipped: boolean;
  /** How you watched it, when that said something. Missing on reactions saved before watching counted. */
  watched?: Watch;
};

const EMPTY: Reaction = { liked: false, saved: false, skipped: false };

type Ctx = {
  reactions: Record<string, Reaction>;
  /** Saved reactions have loaded (or failed to). */
  hydrated: boolean;
  get: (clipId: string) => Reaction;
  setLiked: (clipId: string, liked: boolean) => void;
  toggleSaved: (clipId: string) => void;
  markSkipped: (clipId: string) => void;
  /** A finished watch of a clip. Folded into what the clip already has, never stacked. */
  recordWatch: (clipId: string, watch: Watch) => void;
  /** Forget every reaction (starting your sound over). */
  clear: () => void;
};

const STORAGE_KEY = 'reactions.v1';

const ReactionsContext = createContext<Ctx | null>(null);

export function ReactionsProvider({ children }: { children: ReactNode }) {
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setReactions((current) => ({ ...JSON.parse(raw), ...current }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reactions)).catch(() => {});
  }, [reactions]);

  const update = useCallback((clipId: string, fn: (r: Reaction) => Reaction) => {
    setReactions((all) => {
      const prev = all[clipId] ?? EMPTY;
      const next = fn(prev);
      // Nothing changed: keep the same object so nothing re-renders or re-saves.
      return next === prev ? all : { ...all, [clipId]: next };
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      reactions,
      hydrated,
      get: (id) => reactions[id] ?? EMPTY,
      setLiked: (id, liked) => update(id, (r) => ({ ...r, liked, skipped: liked ? false : r.skipped })),
      toggleSaved: (id) => update(id, (r) => ({ ...r, saved: !r.saved })),
      markSkipped: (id) => update(id, (r) => ({ ...r, skipped: true, liked: false })),
      clear: () => setReactions({}),
      recordWatch: (id, watch) =>
        update(id, (r) => {
          const watched = mergeWatch(r.watched, watch);
          return watched === r.watched ? r : { ...r, watched };
        }),
    }),
    [reactions, hydrated, update],
  );

  return <ReactionsContext.Provider value={value}>{children}</ReactionsContext.Provider>;
}

export function useReactions() {
  const ctx = useContext(ReactionsContext);
  if (!ctx) throw new Error('useReactions must be used inside ReactionsProvider');
  return ctx;
}
