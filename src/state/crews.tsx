import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { crewPath, crewStars, firstName, picksChanged, type CrewStars } from '../features/crews/together';
import { WEB_URL } from '../config/app';
import type { Crew, CrewInvite, CrewPicks, Profile } from '../features/social/models';
import { openInvites } from '../features/crews/invite';
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
  /** Join a crew you were invited to (in the app, or with an invite link's `code`). */
  join: (id: string, code?: string) => Promise<Crew>;
  /** The link that lets friends join a crew you're in (its code made the first time). */
  inviteLink: (id: string) => Promise<string>;
  /** The owner makes a new invite link; the old one stops working. */
  newInviteLink: (id: string) => Promise<string>;
  leave: (id: string) => Promise<void>;
  /** The owner ends the crew for everyone. */
  end: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<Crew>;
  remove: (id: string, uid: string) => Promise<Crew>;
  refresh: () => Promise<void>;
  /** First names of crewmates who starred this set at this festival (never you). */
  crewStarsFor: (festivalId: string, artistId: string) => string[];
  /** Invites to crews you're not in yet, newest first (`openInvites`), and who sent them. */
  invites: CrewInvite[];
  inviters: Record<string, Profile>;
  /** Say no to an invite: it goes for both of you. */
  declineInvite: (crewId: string) => Promise<void>;
};

/** Your stars reach your crews this long after they settle. */
export const CREW_SYNC_MS = 2000;

/** How many invites are read at a time. */
const INVITES_MAX = 30;

const CrewsContext = createContext<Ctx | null>(null);

export function CrewsProvider({ children }: { children: ReactNode }) {
  const social = useSocial();
  const { service } = social;
  const uid = social.user?.uid;
  const active = social.availability.ok && !!uid;
  const [state, setState] = useState<{ uid?: string; crews: Crew[]; loaded: boolean }>({ crews: [], loaded: false });
  // Invites sent to you (read with your crews), and the profiles of who sent them.
  const [inviteState, setInviteState] = useState<{ uid?: string; list: CrewInvite[] }>({ list: [] });
  const [inviters, setInviters] = useState<Record<string, Profile>>({});
  const currentUid = useRef<string | undefined>(undefined);
  useEffect(() => {
    currentUid.current = active ? uid : undefined;
  }, [active, uid]);
  // What each crew last got of your stars (below).
  const published = useRef(new Map<string, string[]>());

  const refresh = useCallback(async () => {
    if (!active || !uid) return;
    service
      .crewInvites(INVITES_MAX)
      .then((list) => currentUid.current === uid && setInviteState({ uid, list }))
      .catch(() => {});
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
    service
      .crewInvites(INVITES_MAX)
      .then((list) => live && setInviteState({ uid, list }))
      .catch(() => {});
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
  const invites = useMemo(
    () => (active && inviteState.uid === uid ? openInvites(inviteState.list, { myCrews: crews.map((c) => c.id), blocked: social.blocked }) : []),
    [active, inviteState, uid, crews, social.blocked],
  );
  // Who invited you, read once each.
  useEffect(() => {
    const missing = [...new Set(invites.map((i) => i.from))].filter((u) => !inviters[u]);
    if (!missing.length) return;
    let live = true;
    Promise.all(missing.map((u) => service.profileOf(u).catch(() => null))).then((found) => {
      if (!live) return;
      setInviters((prev) => {
        const next = { ...prev };
        for (const p of found) if (p) next[p.uid] = p;
        return next;
      });
    });
    return () => {
      live = false;
    };
  }, [invites, inviters, service]);
  const declineInvite = useCallback(
    async (crewId: string) => {
      setInviteState((s) => ({ ...s, list: s.list.filter((i) => i.crewId !== crewId) }));
      await service.declineCrewInvite(crewId).catch(() => {});
    },
    [service],
  );

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
    async (id: string, code?: string) => {
      const crew = await service.joinCrew(id, code);
      put(crew);
      setInviteState((s) => ({ ...s, list: s.list.filter((i) => i.crewId !== id) }));
      return crew;
    },
    [service, put],
  );
  const inviteLink = useCallback(async (id: string) => `${WEB_URL}${crewPath(id, await service.crewInviteCode(id))}`, [service]);
  const newInviteLink = useCallback(async (id: string) => `${WEB_URL}${crewPath(id, await service.newCrewInviteCode(id))}`, [service]);
  const leave = useCallback(
    async (id: string) => {
      await service.leaveCrew(id);
      published.current.delete(id);
      setState((s) => ({ ...s, crews: s.crews.filter((c) => c.id !== id) }));
    },
    [service],
  );
  const end = useCallback(
    async (id: string) => {
      await service.endCrew(id);
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

  // Your crewmates' stars, for showing across the app: read whenever your crews are (sign-in, coming
  // back to the app, joining or leaving), with their names (profiles read once per session).
  const profiles = useRef(new Map<string, Profile | null>());
  const [crewData, setCrewData] = useState<{ uid?: string; list: { crew: Crew; picks: CrewPicks[] }[]; names: Record<string, string> }>({ list: [], names: {} });
  useEffect(() => {
    if (!active || !uid || !crews.length) return;
    let live = true;
    (async () => {
      const list = await Promise.all(
        crews.map(async (crew) => ({ crew, picks: await service.crewPicks(crew.id).catch(() => [] as CrewPicks[]) })),
      );
      const missing = [...new Set(crews.flatMap((c) => c.members))].filter((m) => m !== uid && !profiles.current.has(m));
      await Promise.all(missing.map(async (m) => profiles.current.set(m, await service.profileOf(m).catch(() => null))));
      const names: Record<string, string> = {};
      for (const [m, p] of profiles.current) if (p) names[m] = firstName(p.displayName);
      if (live) setCrewData({ uid, list, names });
    })();
    return () => {
      live = false;
    };
  }, [active, uid, crews, service]);
  const stars = useMemo<CrewStars>(() => {
    if (!active || crewData.uid !== uid) return {};
    // Only crews you're still in (leaving one stops its stars at once).
    const current = new Set(crews.map((c) => c.id));
    return crewStars(crewData.list.filter((x) => current.has(x.crew.id)), {
      me: uid,
      blocked: social.blocked,
      nameOf: (m) => crewData.names[m],
    });
  }, [active, crewData, crews, uid, social.blocked]);

  const value = useMemo<Ctx>(
    () => ({
      crews,
      loaded,
      crewsAt: (festivalId) => crews.filter((c) => c.festivalId === festivalId),
      create,
      join,
      inviteLink,
      newInviteLink,
      leave,
      end,
      rename,
      remove,
      refresh,
      crewStarsFor: (festivalId, artistId) => stars[festivalId]?.[artistId] ?? [],
      invites,
      inviters,
      declineInvite,
    }),
    [crews, loaded, create, join, inviteLink, newInviteLink, leave, end, rename, remove, refresh, stars, invites, inviters, declineInvite],
  );
  return <CrewsContext.Provider value={value}>{children}</CrewsContext.Provider>;
}

export function useCrews() {
  const ctx = useContext(CrewsContext);
  if (!ctx) throw new Error('useCrews must be used inside CrewsProvider');
  return ctx;
}
