import { useEffect, useMemo, useState } from 'react';
import { useSocial } from '../../state/social';
import { splitGoers, type Goers } from './going';
import type { Profile } from './models';

/** How many going profiles are read per festival. */
export const GOERS_MAX = 200;
/** Answers stay fresh this long, so going back and forth doesn't read again. */
const FRESH_MS = 5 * 60_000;
const cache = new Map<string, { at: number; profiles: Profile[] }>();
/** For tests: forget what was read. */
export const forgetGoers = () => cache.clear();

/**
 * Who else is going to a festival (people you follow first), for the
 * festival page. Undefined while signed out, before profiles are set up, or
 * until the first answer; a failed read shows nothing.
 */
export function useGoers(festivalId: string): Goers | undefined {
  const social = useSocial();
  const uid = social.user?.uid;
  const active = social.availability.ok && !!uid;
  const [fetched, setFetched] = useState<{ id: string; list: Profile[] } | undefined>();

  useEffect(() => {
    if (!active) return;
    const hit = cache.get(festivalId);
    if (hit && Date.now() - hit.at < FRESH_MS) return;
    let live = true;
    social.service
      .profilesGoingTo(festivalId, GOERS_MAX)
      .then((list) => {
        cache.set(festivalId, { at: Date.now(), profiles: list });
        if (live) setFetched({ id: festivalId, list });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [active, festivalId, social.service, uid]);

  // What was read for this festival: just now, or earlier (the cache).
  const list = fetched?.id === festivalId ? fetched.list : cache.get(festivalId)?.profiles;
  return useMemo(() => {
    if (!active || !list) return undefined;
    return splitGoers(list, { following: social.following, blocked: social.blocked, me: uid });
  }, [active, list, social.following, social.blocked, uid]);
}
