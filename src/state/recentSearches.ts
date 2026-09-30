import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { addRecent, cleanRecents, removeRecent, type Recent } from '../features/search/universal';

const STORAGE_KEY = 'recentSearches.v1';

/** What you opened from search lately, kept on this phone only. `recents` is undefined until loaded. */
export function useRecentSearches() {
  const [recents, setRecents] = useState<Recent[] | undefined>();
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => (raw ? cleanRecents(JSON.parse(raw)) : []))
      .catch(() => [])
      .then((stored: Recent[]) => {
        loaded.current = true;
        setRecents((current) => (current ? current : stored));
      });
  }, []);

  useEffect(() => {
    if (!loaded.current || !recents) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(recents)).catch(() => {});
  }, [recents]);

  const remember = useCallback((item: Recent) => setRecents((list) => addRecent(list ?? [], item)), []);
  const forget = useCallback((item: Recent) => setRecents((list) => removeRecent(list ?? [], item)), []);
  const clear = useCallback(() => setRecents([]), []);
  return { recents, remember, forget, clear };
}
