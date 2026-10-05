import { useNetworkState } from 'expo-network';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isOffline } from '../offline/status';
import type { Crew, CrewPicks, Profile } from '../social/models';
import { lastKnownFor, rememberLastKnown } from '../../state/lastKnown';
import { useSocial } from '../../state/social';

export type CrewPage =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'missing' }
  | { status: 'failed' }
  | { status: 'ready'; crew: Crew; profiles: Record<string, Profile>; picks: CrewPicks[]; member: boolean; readAt: number; kept?: boolean };

/**
 * Everything a crew's page shows: the crew, its members' profiles and (for
 * members) everyone's shared picks. Read when the page comes into view;
 * `reload` after joining, leaving or changing it, `update` to show a change
 * straight away. With no signal, a crew you're in opens as this phone last
 * read it (`kept`; `readAt` says when), and is read again once there's signal.
 */
export function useCrewPage(id: string) {
  const social = useSocial();
  const uid = social.user?.uid;
  const [page, setPage] = useState<CrewPage>({ status: 'loading' });
  const run = useRef(0);

  const reload = useCallback(async () => {
    const n = ++run.current;
    // Until sign-in has been read back (a link opened cold), keep loading rather than asking to sign in.
    if (!social.ready) {
      setPage({ status: 'loading' });
      return;
    }
    if (!uid) {
      setPage({ status: 'signed-out' });
      return;
    }
    try {
      const crew = await social.service.crew(id);
      if (n !== run.current) return;
      if (!crew) {
        setPage({ status: 'missing' });
        return;
      }
      const member = crew.members.includes(uid);
      const kept = await lastKnownFor(uid);
      const [found, picks] = await Promise.all([
        Promise.all(crew.members.map((m) => social.service.profileOf(m).catch(() => (m === uid ? kept?.profile?.value : kept?.people?.[m]) ?? null))),
        member ? social.service.crewPicks(id) : Promise.resolve([]),
      ]);
      if (n !== run.current) return;
      const profiles: Record<string, Profile> = {};
      for (const p of found) if (p) profiles[p.uid] = p;
      setPage({ status: 'ready', crew, profiles, picks, member, readAt: Date.now() });
      if (member) rememberLastKnown(uid, { picks: { [id]: picks }, people: Object.fromEntries(Object.entries(profiles).filter(([m]) => m !== uid)) });
    } catch {
      // No signal: a crew you're in, as this phone last read it.
      const kept = await lastKnownFor(uid).catch(() => undefined);
      const crew = kept?.crews?.value.find((c) => c.id === id && c.members.includes(uid));
      if (n !== run.current) return;
      if (crew && kept?.crews) {
        const profiles: Record<string, Profile> = {};
        for (const m of crew.members) {
          const p = m === uid ? kept.profile?.value : kept.people?.[m];
          if (p) profiles[m] = p;
        }
        const readAt = kept.crews.at;
        setPage((p) => (p.status === 'ready' ? p : { status: 'ready', crew, profiles, picks: kept.picks?.[id] ?? [], member: true, readAt, kept: true }));
        return;
      }
      setPage((p) => (p.status === 'ready' ? p : { status: 'failed' }));
    }
  }, [id, uid, social.ready, social.service]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Signal back while showing this phone's copy: read it for real.
  const offline = isOffline(useNetworkState());
  const kept = page.status === 'ready' && !!page.kept;
  useEffect(() => {
    if (!kept || offline) return;
    const t = setTimeout(() => void reload(), 0);
    return () => clearTimeout(t);
  }, [kept, offline, reload]);

  const update = useCallback((crew: Crew) => {
    setPage((p) => (p.status === 'ready' ? { ...p, crew, picks: p.picks.filter((x) => crew.members.includes(x.uid)) } : p));
  }, []);

  return { page, reload, update };
}
