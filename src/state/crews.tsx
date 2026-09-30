import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { picksChanged } from '../features/crews/together';
import type { Crew } from '../features/social/models';
import { usePlan } from './plan';
import { useSocial } from './social';

/**
 * Your festival crews: the crews you're in, starting, joining and leaving
 * them, and keeping each crew up to date with your starred sets at its
 * festival (a couple of seconds after they settle, only when they changed).
 * Stars stay a planning preference: sharing them with a crew you chose to
 * join is the only place they go, and never into taste.
 */
type Ctx = {
  /** The crews you're in (empty while signed out). */
  crews: Crew[];
  loaded: boolean;
  crewsAt: (festivalId: string) => Crew[];
  create: (festivalId: string, name: string) => Promise<Crew>;
  join: (id: string) => Promise<Crew>;
  leave: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<Crew>;
  remove: (id: string, uid: string) => Promise<Crew>;
  refresh: () => Promise<void>;
};

/** Your stars reach your crews this long after they settle. */
export const CREW_SYNC_MS = 2000;

const CrewsContext = createContext<Ctx | null>(null);

export function CrewsProvider({ children }: { children: ReactNode }) {
  const social = useSocial();
  const { service } = social;
  const uid = social.user?.uid;
  const active = social.availability.ok && !!uid;
  const [state, setState] = useState<{ uid?: string; crews: Crew[]; loaded: boolean }>({ crews: [], loaded: false });
  const currentUid = useRef<string | undefined>(undefined);
  useEffect(() => {
    currentUid.current = active ? uid : undefined;
  }, [active, uid]);
  // What each crew last got of your stars (below).
  const published = useRef(new Map<string, string[]>());

  const refresh = useCallback(async () => {
    if (!active || !uid) return;
    try {
      const crews = await service.myCrews();
      if (currentUid.current === uid) setState({ uid, crews, loaded: true });
    } catch {
      if (currentUid.current === uid) setState((s) => (s.uid === uid ? { ...s, loaded: true } : { uid, crews: [], loaded: true }));
    }
  }, [active, uid, service]);

  // Load on sign-in and whenever the app comes back (someone may have joined or left).
  useEffect(() => {
    if (!active || !uid) return;
    let live = true;
    service
      .myCrews()
      .then((list) => live && setState({ uid, crews: list, loaded: true }))
      .catch(() => live && setState({ uid, crews: [], loaded: true }));
    return () => {
      live = false;
    };
  }, [active, uid, service]);
  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [active, refresh]);

  const crews = useMemo(() => (active && state.uid === uid ? state.crews : []), [active, state, uid]);
  const loaded = active && state.uid === uid && state.loaded;

  const put = useCallback((crew: Crew) => {
    setState((s) => ({ ...s, crews: [...s.crews.filter((c) => c.id !== crew.id), crew] }));
  }, []);

  const create = useCallback(
    async (festivalId: string, name: string) => {
      const crew = await service.createCrew(festivalId, name);
      put(crew);
      return crew;
    },
    [service, put],
  );
  const join = useCallback(
    async (id: string) => {
      const crew = await service.joinCrew(id);
      put(crew);
      return crew;
    },
    [service, put],
  );
  const leave = useCallback(
    async (id: string) => {
      await service.leaveCrew(id);
      published.current.delete(id);
      setState((s) => ({ ...s, crews: s.crews.filter((c) => c.id !== id) }));
    },
    [service],
  );
  const rename = useCallback(
    async (id: string, name: string) => {
      const crew = await service.renameCrew(id, name);
      put(crew);
      return crew;
    },
    [service, put],
  );
  const remove = useCallback(
    async (id: string, who: string) => {
      const crew = await service.removeFromCrew(id, who);
      put(crew);
      return crew;
    },
    [service, put],
  );

  // Your stars, shared with each crew you're in. What each crew last got is remembered for this session,
  // so a crew hears about a change once; a failed send is forgotten and tried again on the next change.
  const plan = usePlan();
  useEffect(() => {
    published.current.clear();
  }, [uid]);
  useEffect(() => {
    if (!crews.length) return;
    const due = crews
      .map((c) => ({ id: c.id, artists: [...plan.mustSeesAt(c.festivalId)] }))
      .filter((p) => picksChanged(p.artists, published.current.get(p.id)));
    if (!due.length) return;
    const t = setTimeout(() => {
      for (const p of due) {
        published.current.set(p.id, p.artists);
        service.setCrewPicks(p.id, p.artists).catch(() => published.current.delete(p.id));
      }
    }, CREW_SYNC_MS);
    return () => clearTimeout(t);
  }, [crews, plan, service]);

  const value = useMemo<Ctx>(
    () => ({
      crews,
      loaded,
      crewsAt: (festivalId) => crews.filter((c) => c.festivalId === festivalId),
      create,
      join,
      leave,
      rename,
      remove,
      refresh,
    }),
    [crews, loaded, create, join, leave, rename, remove, refresh],
  );
  return <CrewsContext.Provider value={value}>{children}</CrewsContext.Provider>;
}

export function useCrews() {
  const ctx = useContext(CrewsContext);
  if (!ctx) throw new Error('useCrews must be used inside CrewsProvider');
  return ctx;
}
