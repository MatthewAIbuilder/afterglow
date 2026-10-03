import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'profileShelves.v1';
export type Shelf = 'artists' | 'festivals' | 'garden';
const SHELVES: Shelf[] = ['artists', 'festivals', 'garden'];

/** Which rows on your profile you've tucked away (Your artists, Your festivals), on this phone. */
export function useProfileShelves() {
  const [hidden, setHidden] = useState<ReadonlySet<Shelf>>(() => new Set());
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const list: unknown = raw ? JSON.parse(raw) : [];
        if (live && Array.isArray(list)) setHidden(new Set(SHELVES.filter((s) => list.includes(s))));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const toggle = useCallback((shelf: Shelf) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(shelf)) next.delete(shelf);
      else next.add(shelf);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);
  return { hidden, toggle };
}
