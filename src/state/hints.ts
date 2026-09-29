import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cleanHints, type Hint } from '../features/discover/hints';

const STORAGE_KEY = 'hints.v1';

/**
 * Which first-time tips you're past, saved on the device. `done` is undefined
 * until the saved list has loaded, so a tip never flashes up for someone who
 * finished it long ago.
 */
export function useHints() {
  const [done, setDone] = useState<ReadonlySet<Hint> | undefined>();
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => (raw ? cleanHints(JSON.parse(raw)) : []))
      .catch(() => [])
      .then((stored: Hint[]) => {
        loaded.current = true;
        setDone((current) => new Set([...stored, ...(current ?? [])]));
      });
  }, []);

  useEffect(() => {
    if (!loaded.current || !done) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...done])).catch(() => {});
  }, [done]);

  const markDone = useCallback((hints: Hint[]) => {
    setDone((current) => {
      if (!current) return current;
      const fresh = hints.filter((h) => !current.has(h));
      return fresh.length ? new Set([...current, ...fresh]) : current;
    });
  }, []);

  return { done, markDone };
}
