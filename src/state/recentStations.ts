import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { addStation, cleanStations } from '../features/recommend/station';

const STORAGE_KEY = 'recentStations.v1';

function read(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return cleanStations(JSON.parse(raw));
  } catch {
    // A damaged list is simply forgotten.
    return [];
  }
}

/**
 * The last few stations you started in Discover ("Sounds like …"), newest
 * first, as artist ids, kept on the phone for What to discover. `stations`
 * is empty while loading.
 */
export function useRecentStations() {
  const [stations, setStations] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((raw) => {
        if (live) setStations(read(raw));
      });
    return () => {
      live = false;
    };
  }, []);

  const remember = useCallback((artistId: string) => {
    // Read first, so a station started on another screen isn't lost.
    AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((raw) => {
        const next = addStation(read(raw), artistId);
        setStations(next);
        return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      })
      .catch(() => {});
  }, []);

  return { stations, remember };
}
