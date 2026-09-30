import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import type { Crew, CrewPicks, Profile } from '../social/models';
import { useSocial } from '../../state/social';

export type CrewPage =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'missing' }
  | { status: 'failed' }
  | { status: 'ready'; crew: Crew; profiles: Record<string, Profile>; picks: CrewPicks[]; member: boolean };

/**
 * Everything a crew's page shows: the crew, its members' profiles and (for
 * members) everyone's shared picks. Read when the page comes into view;
 * `reload` after joining, leaving or changing it, `update` to show a change
 * straight away.
 */
export function useCrewPage(id: string) {
  const social = useSocial();
  const uid = social.user?.uid;
  const [page, setPage] = useState<CrewPage>({ status: 'loading' });
  const run = useRef(0);

  const reload = useCallback(async () => {
    const n = ++run.current;
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
      const [found, picks] = await Promise.all([
        Promise.all(crew.members.map((m) => social.service.profileOf(m).catch(() => null))),
        member ? social.service.crewPicks(id) : Promise.resolve([]),
      ]);
      if (n !== run.current) return;
      const profiles: Record<string, Profile> = {};
      for (const p of found) if (p) profiles[p.uid] = p;
      setPage({ status: 'ready', crew, profiles, picks, member });
    } catch {
      if (n === run.current) setPage((p) => (p.status === 'ready' ? p : { status: 'failed' }));
    }
  }, [id, uid, social.service]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const update = useCallback((crew: Crew) => {
    setPage((p) => (p.status === 'ready' ? { ...p, crew, picks: p.picks.filter((x) => crew.members.includes(x.uid)) } : p));
  }, []);

  return { page, reload, update };
}
