import { useEffect, useSyncExternalStore } from 'react';
import type { Standing } from '../social/models';
import { useSocial } from '../../state/social';

/** Standings stay fresh this long. */
const FRESH_MS = 10 * 60_000;
const cache = new Map<string, { at: number; standing: Standing }>();
const asking = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;
const changed = () => {
  version++;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Set someone's standing straight away (your own, after claiming a founder number). */
export function rememberStanding(uid: string, standing: Standing) {
  cache.set(uid, { at: Date.now(), standing });
  changed();
}

/** Change part of a standing already read (your own level, after publishing it). Nothing when it hasn't been read yet. */
export function patchStanding(uid: string, patch: (s: Standing) => Standing) {
  const hit = cache.get(uid);
  if (!hit) return;
  cache.set(uid, { at: hit.at, standing: patch(hit.standing) });
  changed();
}

/** For tests: forget everything read. */
export function forgetStandings() {
  cache.clear();
  asking.clear();
  changed();
}

/**
 * Someone's founder number and flair, for their ring and caption: read once
 * and kept for a while, shared by every avatar of theirs on screen.
 * Undefined until read, when signed out, or when profiles aren't set up.
 */
export function useStanding(uid: string | undefined): Standing | undefined {
  const social = useSocial();
  const ok = social.availability.ok;
  useSyncExternalStore(subscribe, () => version);
  useEffect(() => {
    if (!ok || !uid) return;
    const hit = cache.get(uid);
    if ((hit && Date.now() - hit.at < FRESH_MS) || asking.has(uid)) return;
    asking.add(uid);
    social.service
      .standingOf(uid)
      .then((s) => rememberStanding(uid, s))
      .catch(() => {})
      .finally(() => asking.delete(uid));
  }, [ok, uid, social.service]);
  return ok && uid ? cache.get(uid)?.standing : undefined;
}
