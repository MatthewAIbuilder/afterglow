import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cleanRatings, rate, type Rating, type Ratings } from '../features/taste/ratings';

/**
 * Artists you've rated directly ("love their sound", "not for me"). A taste
 * signal like reactions, saved on the device.
 */
type Ctx = {
  ratings: Ratings;
  rate: (artistId: string, rating: Rating | undefined) => void;
  /** Forget every rating (starting your sound over). */
  clear: () => void;
};

const STORAGE_KEY = 'artistRatings.v1';

const RatingsContext = createContext<Ctx | null>(null);

export function RatingsProvider({ children }: { children: ReactNode }) {
  const [ratings, setRatings] = useState<Ratings>({});
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setRatings((current) => ({ ...cleanRatings(JSON.parse(raw)), ...current }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ratings)).catch(() => {});
  }, [ratings]);

  const set = useCallback((artistId: string, rating: Rating | undefined) => {
    setRatings((all) => rate(all, artistId, rating));
  }, []);

  const value = useMemo<Ctx>(() => ({ ratings, rate: set, clear: () => setRatings({}) }), [ratings, set]);
  return <RatingsContext.Provider value={value}>{children}</RatingsContext.Provider>;
}

export function useRatings() {
  const ctx = useContext(RatingsContext);
  if (!ctx) throw new Error('useRatings must be used inside RatingsProvider');
  return ctx;
}
