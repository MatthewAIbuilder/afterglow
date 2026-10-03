import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import type { LivePatch } from '../features/social/models';

const STORAGE_KEY = 'livePatches.v1';

/**
 * Catalogue updates published from HQ, as this phone last read them (kept,
 * so they still apply without signal). A shared store: `LivePatchSync`
 * fills it, the catalogue applies it.
 */
let patches: LivePatch[] | undefined;
const listeners = new Set<(p: LivePatch[]) => void>();
let loading: Promise<void> | undefined;

const clean = (raw: unknown): LivePatch[] =>
  Array.isArray(raw)
    ? raw.filter((p): p is LivePatch => !!p && typeof p === 'object' && typeof p.id === 'string' && typeof p.file === 'string' && typeof p.festivalId === 'string' && typeof p.publishedAt === 'string')
    : [];

function load() {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => clean(raw ? JSON.parse(raw) : []))
    .catch(() => [] as LivePatch[])
    .then((read) => {
      // Fresh ones read while loading win.
      patches ??= read;
      listeners.forEach((l) => l(patches!));
    });
  return loading;
}

/** What the server says is published now (replaces the kept list). */
export function setLivePatches(next: LivePatch[]) {
  const same = patches && patches.length === next.length && patches.every((p, i) => p.id === next[i].id);
  if (same) return;
  patches = next;
  listeners.forEach((l) => l(next));
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

/** For tests: forget what's loaded. */
export function forgetLivePatches() {
  patches = undefined;
  loading = undefined;
  listeners.clear();
}

/** The published updates (empty until read). */
export function useLivePatches(): LivePatch[] {
  const [p, setP] = useState<LivePatch[]>(patches ?? []);
  useEffect(() => {
    listeners.add(setP);
    void load().then(() => patches && setP(patches));
    return () => {
      listeners.delete(setP);
    };
  }, []);
  return p;
}
