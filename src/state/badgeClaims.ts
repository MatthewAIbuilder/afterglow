import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { cleanClaims } from '../features/profile/milestones';

const STORAGE_KEY = 'badgeClaims.v1';

/**
 * Badges you've claimed (seen the unlock for), on this phone. `claimed` is
 * undefined until loaded, so nothing asks to be claimed before then.
 */
export function useBadgeClaims() {
  const [claimed, setClaimed] = useState<ReadonlySet<string> | undefined>();
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => (raw ? cleanClaims(JSON.parse(raw)) : []))
      .catch(() => [])
      .then((list) => live && setClaimed(new Set(list)));
    return () => {
      live = false;
    };
  }, []);
  const claim = useCallback((key: string) => {
    setClaimed((current) => {
      if (!current || current.has(key)) return current;
      const next = new Set([...current, key]);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);
  return { claimed, claim };
}
