import { useEffect, useMemo, useState } from 'react';
import { useCommunity } from '../../state/community';
import { useSocial } from '../../state/social';
import { crowdVideos } from '../community/crowd';
import type { SharedMemory } from '../social/models';

/** At most this many of a festival's videos are read. */
export const CROWD_MAX = 120;
/** Answers stay fresh this long (shorter while it's on, so new videos arrive). */
const FRESH_MS = 3 * 60_000;
const LIVE_FRESH_MS = 60_000;
const cache = new Map<string, { at: number; list: SharedMemory[] }>();
/** For tests: forget what was read. */
export const forgetCrowd = () => cache.clear();

/**
 * A festival's videos from the crowd (newest shared first, no blocked people
 * or hidden videos), read once and shared by everything showing them.
 * Undefined until read, when signed out, or when profiles aren't set up.
 */
export function useFestivalCrowd(festivalId: string, live = false): { videos: SharedMemory[] | undefined; failed: boolean } {
  const social = useSocial();
  const { hidden } = useCommunity();
  const signedIn = social.availability.ok && !!social.user;
  const [read, setRead] = useState<{ id: string; list: SharedMemory[] } | 'failed' | undefined>();
  useEffect(() => {
    if (!signedIn) return;
    const hit = cache.get(festivalId);
    if (hit && Date.now() - hit.at < (live ? LIVE_FRESH_MS : FRESH_MS)) return;
    let alive = true;
    social.service
      .festivalMemories(festivalId, CROWD_MAX)
      .then((list) => {
        cache.set(festivalId, { at: Date.now(), list });
        if (alive) setRead({ id: festivalId, list });
      })
      .catch(() => alive && setRead('failed'));
    return () => {
      alive = false;
    };
  }, [signedIn, festivalId, social.service, live]);
  const raw = read && read !== 'failed' && read.id === festivalId ? read.list : cache.get(festivalId)?.list;
  const videos = useMemo(() => (signedIn && raw ? crowdVideos(raw, { blocked: [...social.blocked], hidden: [...hidden] }) : undefined), [signedIn, raw, social.blocked, hidden]);
  return { videos, failed: read === 'failed' };
}
