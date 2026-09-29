import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cleanFollows, follow, unfollow, type Follows } from '../features/follow/follows';
import { useCatalog } from './catalog';

/**
 * Artists you follow, saved on the device, with what was already known about
 * each when you followed (so the bell only brings news). A quiet taste signal,
 * and it stays when you start your sound over: it's who you want news of.
 */
type Ctx = {
  follows: Follows;
  /** Followed artist ids, in the order you followed them. */
  followed: readonly string[];
  isFollowing: (artistId: string) => boolean;
  toggle: (artistId: string) => void;
  hydrated: boolean;
};

const STORAGE_KEY = 'follows.v1';

const FollowsContext = createContext<Ctx | null>(null);

export function FollowsProvider({ children }: { children: ReactNode }) {
  const { festivals } = useCatalog();
  const [follows, setFollows] = useState<Follows>({});
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setFollows((current) => ({ ...cleanFollows(JSON.parse(raw)), ...current }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(follows)).catch(() => {});
  }, [follows]);

  const toggle = useCallback(
    (artistId: string) =>
      setFollows((all) => (all[artistId] ? unfollow(all, artistId) : follow(all, artistId, festivals, new Date()))),
    [festivals],
  );
  const value = useMemo<Ctx>(() => {
    const followed = Object.keys(follows);
    return { follows, followed, isFollowing: (id) => !!follows[id], toggle, hydrated };
  }, [follows, toggle, hydrated]);
  return <FollowsContext.Provider value={value}>{children}</FollowsContext.Provider>;
}

export function useFollows() {
  const ctx = useContext(FollowsContext);
  if (!ctx) throw new Error('useFollows must be used inside FollowsProvider');
  return ctx;
}
