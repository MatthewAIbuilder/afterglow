import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addRecent, cleanRecents, recentsFor, removeRecent, type Recent } from '../features/search/universal';

const STORAGE_KEY = 'recentSearches.v1';

/**
 * What you opened from search lately, kept on this phone only. `recents` is
 * undefined until loaded. People you looked up stay with the account that
 * looked (`uid`): after a switch or sign-out they aren't shown.
 */
export function useRecentSearches(uid: string | undefined) {
  const [list, setList] = useState<Recent[] | undefined>();
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => (raw ? cleanRecents(JSON.parse(raw)) : []))
      .catch(() => [])
      .then((stored: Recent[]) => {
        loaded.current = true;
        // Anything opened before the read finished goes on top of what was saved.
        setList((current) => (current ? [...current].reverse().reduce(addRecent, stored) : stored));
      });
  }, []);

  useEffect(() => {
    if (!loaded.current || !list) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)).catch(() => {});
  }, [list]);

  const remember = useCallback(
    (item: Recent) => {
      if (item.kind === 'person' && !uid) return;
      setList((l) => addRecent(l ?? [], item.kind === 'person' ? { ...item, by: uid } : item));
    },
    [uid],
  );
  const forget = useCallback((item: Recent) => setList((l) => removeRecent(l ?? [], item)), []);
  // Clears what this account sees; other accounts' people stay theirs.
  const clear = useCallback(() => setList((l) => (l ?? []).filter((r) => r.kind === 'person' && r.by !== uid)), [uid]);
  const recents = useMemo(() => (list ? recentsFor(list, uid) : undefined), [list, uid]);
  return { recents, remember, forget, clear };
}
