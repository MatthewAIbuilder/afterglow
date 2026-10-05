import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '../../state/catalog';
import { useSocial } from '../../state/social';
import type { SharedMemory } from '../social/models';
import { earnedBadges, throwbackBadges, type Badge, type ThrowbackBadge } from './badges';

/** Someone's shared videos stay fresh this long for their badges. */
const FRESH_MS = 5 * 60_000;
const cache = new Map<string, { at: number; memories: SharedMemory[] }>();
/** Reads under way, shared by every screen asking for the same person (your glow level asks too). */
const pending = new Map<string, Promise<SharedMemory[]>>();
/** For tests: forget what was read. */
export const forgetBadges = () => {
  cache.clear();
  pending.clear();
};

/**
 * Someone's festival pins, from the videos they've shared (tagged with the
 * festival and filmed there, on its dates). `loaded` once their videos have
 * been read; nothing when signed out or profiles aren't set up.
 */
export function useBadges(uid: string | undefined): { badges: Badge[]; throwbacks: ThrowbackBadge[]; loaded: boolean } {
  const social = useSocial();
  const catalog = useCatalog();
  const ok = social.availability.ok && !!social.user && !!uid;
  const [read, setRead] = useState<{ uid: string; memories: SharedMemory[] } | undefined>();
  useEffect(() => {
    if (!ok || !uid) return;
    const hit = cache.get(uid);
    if (hit && Date.now() - hit.at < FRESH_MS) return;
    let live = true;
    let ask = pending.get(uid);
    if (!ask) {
      ask = social.service.memoriesOf(uid).then((memories) => {
        cache.set(uid, { at: Date.now(), memories });
        return memories;
      });
      const asked = ask;
      pending.set(uid, asked);
      void asked.catch(() => {}).finally(() => {
        if (pending.get(uid) === asked) pending.delete(uid);
      });
    }
    ask
      .then((memories) => {
        if (live) setRead({ uid, memories });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [ok, uid, social.service]);
  const memories = (read?.uid === uid ? read?.memories : undefined) ?? (uid ? cache.get(uid)?.memories : undefined);
  const badges = useMemo(() => (memories ? earnedBadges(memories, catalog.festival) : []), [memories, catalog.festival]);
  // Throwbacks they've shared: past festivals, from their camera roll.
  const throwbacks = useMemo(() => (memories ? throwbackBadges(memories) : []), [memories]);
  return { badges, throwbacks, loaded: !!memories };
}
