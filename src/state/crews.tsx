import { useNetworkState } from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { crewPath, crewStars, distinctNames, picksChanged, type CrewStars } from '../features/crews/together';
import { WEB_URL } from '../config/app';
import type { Crew, CrewInvite, CrewPicks, Profile } from '../features/social/models';
import { openInvites } from '../features/crews/invite';
import { isOffline } from '../features/offline/status';
import { lastKnownFor, rememberLastKnown } from './lastKnown';
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
  /** Your crews were read from the server this session (not a list left empty by a failed read): safe to tidy against. */
  confirmed: boolean;
  /** When the crews shown are this phone's copy (no signal on opening): when they were last read. */
  keptAt?: number;
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
  const [state, setState] = useState<{ uid?: string; crews: Crew[]; loaded: boolean; confirmed?: boolean; keptAt?: number }>({ crews: [], loaded: false });
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
      if (currentUid.current === uid) {
        setState({ uid, crews, loaded: true, confirmed: true });
        rememberLastKnown(uid, { crews: { value: crews, at: Date.now() } });
      }
    } catch {
      // No answer: keep what's shown, or this phone's copy (never "no crews").
      const kept = (await lastKnownFor(uid))?.crews;
      if (currentUid.current === uid)
        setState((s) => (s.uid === uid && (s.confirmed || !kept) ? { ...s, loaded: true } : { uid, crews: kept?.value ?? [], loaded: true, keptAt: kept?.at }));
    }
  }, [active, uid, service]);

  // Load on sign-in and whenever the app comes back (someone may have joined or left), and when signal comes back.
  useEffect(() => {
    if (!active || !uid) return;
    let live = true;
    service
      .myCrews()
      .then((list) => {
        if (!live) return;
        setState({ uid, crews: list, loaded: true, confirmed: true });
        rememberLastKnown(uid, { crews: { value: list, at: Date.now() } });
      })
      .catch(async () => {
        // No signal on opening: your crews as this phone last read them.
        const kept = (await lastKnownFor(uid))?.crews;
        if (live) setState({ uid, crews: kept?.value ?? [], loaded: true, keptAt: kept?.at });
      });
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
  const offline = isOffline(useNetworkState());
  const unconfirmed = active && !!uid && state.uid === uid && state.loaded && !state.confirmed;
  useEffect(() => {
    if (offline || !unconfirmed) return;
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [offline, unconfirmed, refresh]);

  const crews = useMemo(() => (active && state.uid === uid ? state.crews : []), [active, state, uid]);
  const loaded = active && state.uid === uid && state.loaded;
  const confirmed = loaded && !!state.confirmed;
  const keptAt = loaded && !state.confirmed ? state.keptAt : undefined;
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
  // With no signal, each crew's stars and each crewmate's name come from this phone's copy (state/lastKnown).
  const profiles = useRef(new Map<string, Profile | null>());
  const keptPeople = useRef(new Set<string>());
  const [crewData, setCrewData] = useState<{ uid?: string; list: { crew: Crew; picks: CrewPicks[] }[]; names: Record<string, string> }>({ list: [], names: {} });
  const [picksTick, setPicksTick] = useState(0);
  useEffect(() => {
    if (!active || !uid || !crews.length) return;
    let live = true;
    (async () => {
      const kept = await lastKnownFor(uid);
      const read: Record<string, CrewPicks[]> = {};
      const list = await Promise.all(
        crews.map(async (crew) => {
          const picks = await service.crewPicks(crew.id).catch(() => undefined);
          if (picks) read[crew.id] = picks;
          return { crew, picks: picks ?? kept?.picks?.[crew.id] ?? [] };
        }),
      );
      const missing = [...new Set(crews.flatMap((c) => c.members))].filter((m) => m !== uid && !profiles.current.has(m));
      const people: Record<string, Profile> = {};
      await Promise.all(
        missing.map(async (m) => {
          try {
            const p = await service.profileOf(m);
            profiles.current.set(m, p);
            keptPeople.current.delete(m);
            if (p) people[m] = p;
          } catch {
            // No answer: this phone's copy for now, read again next time.
            const k = kept?.people?.[m];
            if (k) {
              profiles.current.set(m, k);
              keptPeople.current.add(m);
            }
          }
        }),
      );
      if (Object.keys(read).length || Object.keys(people).length) rememberLastKnown(uid, { picks: read, people });
      // First names, told apart when two people share one ("Sam K." and "Sam R.").
      const names = distinctNames([...profiles.current].flatMap(([m, p]) => (p ? [{ uid: m, displayName: p.displayName }] : [])));
      if (live) setCrewData({ uid, list, names });
    })();
    return () => {
      live = false;
    };
  }, [active, uid, crews, service, picksTick]);
  // Signal back: read the stars again (a copy from this phone is only for now).
  const wasOffline = useRef(false);
  useEffect(() => {
    if (offline) wasOffline.current = true;
    else if (wasOffline.current) {
      wasOffline.current = false;
      for (const m of keptPeople.current) profiles.current.delete(m);
      setPicksTick((n) => n + 1);
    }
  }, [offline]);
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
      confirmed,
      keptAt,
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
    [crews, loaded, confirmed, keptAt, create, join, inviteLink, newInviteLink, leave, end, rename, remove, refresh, stars, invites, inviters, declineInvite],
  );
  return <CrewsContext.Provider value={value}>{children}</CrewsContext.Provider>;
}

export function useCrews() {
  const ctx = useContext(CrewsContext);
  if (!ctx) throw new Error('useCrews must be used inside CrewsProvider');
  return ctx;
}
