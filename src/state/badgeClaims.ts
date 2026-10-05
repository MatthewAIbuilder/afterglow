import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { cleanClaims } from '../features/profile/milestones';

const STORAGE_KEY = 'badgeClaims.v1';

/**
 * Badges you've claimed (seen the unlock for), on this phone. A shared store,
 * so a claim on Profile reaches your glow level, the level on your profile
 * and the quest toast at once. `claimed` is undefined until loaded, so
 * nothing asks to be claimed before then; after a read that failed, claims
 * stay in memory and nothing is saved over what's there.
 */
let claimed: ReadonlySet<string> | undefined;
let writable = false;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      writable = true;
      try {
        return raw ? cleanClaims(JSON.parse(raw)) : [];
      } catch {
        return [];
      }
    })
    .catch(() => [] as string[])
    .then((list) => {
      claimed = new Set([...list, ...(claimed ?? [])]);
      emit();
    });
  return loading;
}

/** Mark a badge claimed (once loaded). */
export function claimBadge(key: string) {
  if (!claimed || claimed.has(key)) return;
  claimed = new Set([...claimed, key]);
  emit();
  if (writable) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...claimed])).catch(() => {});
}

/** For tests: forget what's loaded. */
export function forgetBadgeClaims() {
  claimed = undefined;
  writable = false;
  loading = undefined;
  listeners.clear();
}

export function useBadgeClaims() {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    void load().then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const claim = useCallback((key: string) => claimBadge(key), []);
  return { claimed, claim };
}
