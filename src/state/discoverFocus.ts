import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { Focus } from '../features/discover/focus';

const STORAGE_KEY = 'discoverFocus.v1';

/**
 * What Discover was last focused on (a festival id, or your mix), saved on the
 * device so it opens where you left it. `stored` is undefined while loading and
 * null when nothing was saved.
 */
export function useStoredFocus() {
  const [stored, setStored] = useState<string | null | undefined>();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((raw) => setStored(raw || null));
  }, []);

  const save = useCallback((focus: Focus) => {
    AsyncStorage.setItem(STORAGE_KEY, focus).catch(() => {});
  }, []);

  return { stored, save };
}
