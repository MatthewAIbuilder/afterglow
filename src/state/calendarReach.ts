import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_KM, parseReach, type Reach } from '../features/festivals/reach';

const STORAGE_KEY = 'calendarReach.v1';

/** How far the festival calendar looks (near you, a state, everywhere), remembered on the device. */
export function useCalendarReach() {
  const [reach, setReach] = useState<Reach>({ kind: 'near', km: DEFAULT_KM });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!live || !raw) return;
        try {
          const saved = parseReach(JSON.parse(raw));
          if (saved) setReach(saved);
        } catch {}
      })
      .catch(() => {})
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  const change = useCallback((next: Reach) => {
    setReach(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);
  return { reach, setReach: change, ready };
}
