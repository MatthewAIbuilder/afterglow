import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { cleanSeen, markSeen, type SeenSet, seenKey, type SetsSeen, unmarkSeen } from '../features/seen/seen';

/**
 * Sets you've seen, kept on this phone (`setsSeen.v1`, per account): the sets
 * you rated or said you were at, and the ones you waved off ("I wasn't
 * there"), so they aren't asked about again. One copy shared by every screen.
 */
export const SETS_SEEN_KEY = 'setsSeen.v1';

type Saved = { sets: SetsSeen; waved: string[] };
const WAVED_MAX = 300;

let cache: Saved | undefined;
let loading: Promise<Saved> | undefined;
const listeners = new Set<() => void>();

function load(): Promise<Saved> {
  if (cache) return Promise.resolve(cache);
  loading ??= AsyncStorage.getItem(SETS_SEEN_KEY)
    .then((raw) => {
      const o = raw ? (JSON.parse(raw) as { sets?: unknown; waved?: unknown }) : {};
      const waved = Array.isArray(o.waved) ? o.waved.filter((w): w is string => typeof w === 'string').slice(-WAVED_MAX) : [];
      return { sets: cleanSeen(o.sets), waved };
    })
    .catch(() => ({ sets: {}, waved: [] }))
    .then((s) => {
      cache ??= s;
      loading = undefined;
      return cache;
    });
  return loading;
}

function save(next: Saved) {
  cache = next;
  listeners.forEach((l) => l());
  void AsyncStorage.setItem(SETS_SEEN_KEY, JSON.stringify(next)).catch(() => {});
}

/** Forget the copy in memory (another account, or a test starting over). */
export function forgetSetsSeen() {
  cache = undefined;
  loading = undefined;
}

export function useSetsSeen() {
  const [state, setState] = useState<Saved | undefined>(cache);
  useEffect(() => {
    let live = true;
    const l = () => live && setState(cache);
    listeners.add(l);
    void load().then(l);
    return () => {
      live = false;
      listeners.delete(l);
    };
  }, []);
  /** You were there (now, unless the set says when). */
  const mark = useCallback((set: Omit<SeenSet, 'at'> & { at?: number }) => void load().then((s) => save({ ...s, sets: markSeen(s.sets, { ...set, at: set.at ?? Date.now() }) })), []);
  const unmark = useCallback((festivalId: string, artistId: string, day?: string) => void load().then((s) => save({ ...s, sets: unmarkSeen(s.sets, festivalId, artistId, day) })), []);
  const wave = useCallback(
    (festivalId: string, artistId: string, day?: string) =>
      void load().then((s) => {
        const key = seenKey(festivalId, artistId, day);
        save({ sets: unmarkSeen(s.sets, festivalId, artistId, day), waved: [...s.waved.filter((w) => w !== key), key].slice(-WAVED_MAX) });
      }),
    [],
  );
  return { sets: state?.sets ?? {}, waved: state?.waved ?? [], loaded: !!state, mark, unmark, wave };
}
