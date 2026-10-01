import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cleanFollowed, withFollow } from '../features/artists/follow';

/**
 * Artists you follow, newest first. Saved on the phone (AsyncStorage
 * `followedArtists.v1`). A plan, never fed to the taste engine: it only makes
 * them count as artists you'd love (lineup news, festival shelves).
 */
type Ctx = { followed: string[]; isFollowing: (id: string) => boolean; setFollowing: (id: string, on: boolean) => void; hydrated: boolean };

const KEY = 'followedArtists.v1';
const FollowedContext = createContext<Ctx | null>(null);

export function FollowedArtistsProvider({ children }: { children: ReactNode }) {
  const [followed, setFollowed] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        // Anything followed before the saved list came back stays on top.
        if (raw) setFollowed((cur) => cleanFollowed([...cur, ...cleanFollowed(JSON.parse(raw))]));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);
  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(KEY, JSON.stringify(followed)).catch(() => {});
  }, [followed]);

  const set = useMemo(() => new Set(followed), [followed]);
  const isFollowing = useCallback((id: string) => set.has(id), [set]);
  const setFollowing = useCallback((id: string, on: boolean) => setFollowed((list) => withFollow(list, id, on)), []);

  const value = useMemo<Ctx>(() => ({ followed, isFollowing, setFollowing, hydrated }), [followed, isFollowing, setFollowing, hydrated]);
  return <FollowedContext.Provider value={value}>{children}</FollowedContext.Provider>;
}

const OFF: Ctx = { followed: [], isFollowing: () => false, setFollowing: () => {}, hydrated: true };

/** Outside the provider (some tests), nobody is followed. */
export function useFollowedArtists(): Ctx {
  return useContext(FollowedContext) ?? OFF;
}
