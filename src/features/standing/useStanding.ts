import { useEffect, useSyncExternalStore } from 'react';
import type { Standing } from '../social/models';
import { useSocialMaybe } from '../../state/social';

/** Standings stay fresh this long. */
const FRESH_MS = 10 * 60_000;
const cache = new Map<string, { at: number; standing: Standing }>();
const asking = new Set<string>();
/** Standings whose last read failed (no signal), so whoever waits for one can stop waiting. */
const failed = new Set<string>();
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
  failed.clear();
  changed();
}

/**
 * Someone's founder number and flair, for their ring and caption: read once
 * and kept for a while, shared by every avatar of theirs on screen.
 * Undefined until read, when signed out, or when profiles aren't set up.
 */
export function useStanding(uid: string | undefined): Standing | undefined {
  return useStandingRead(uid).standing;
}

/**
 * The same, and whether the read is over: `settled` once it has been read,
 * or the read failed, or there's nothing to read (signed out, no profiles).
 */
export function useStandingRead(uid: string | undefined): { standing: Standing | undefined; settled: boolean } {
  const social = useSocialMaybe();
  const ok = !!social?.availability.ok;
  const service = social?.service;
  useSyncExternalStore(subscribe, () => version);
  useEffect(() => {
    if (!ok || !uid || !service) return;
    const hit = cache.get(uid);
    if ((hit && Date.now() - hit.at < FRESH_MS) || asking.has(uid)) return;
    asking.add(uid);
    service
      .standingOf(uid)
      .then((s) => {
        failed.delete(uid);
        rememberStanding(uid, s);
      })
      .catch(() => {
        failed.add(uid);
        changed();
      })
      .finally(() => asking.delete(uid));
  }, [ok, uid, service]);
  const standing = ok && uid ? cache.get(uid)?.standing : undefined;
  return { standing, settled: !ok || !uid || !!standing || failed.has(uid) };
}
