import AsyncStorage from '@react-native-async-storage/async-storage';
import { partnersOf } from '../data/b2b';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { Clip, Festival } from '../data/models';
import { cleanKept, COMMUNITY_MAX, communityClips, keepClip, keptClips, PLAYERS_JOIN, rememberArtist } from '../features/community/clips';
import { isSoundCloudCardId, reactedCards } from '../features/discover/soundcloud';
import { withOwner } from '../features/community/likes';
import type { SharedMemory } from '../features/social/models';
import { useCatalog } from './catalog';
import { useReactions } from './reactions';
import { useSocial } from './social';

/**
 * Community clips in Discover: whether you want them, the ones you hid or
 * reported, and which artist each community clip you reacted to was of (so
 * those reactions keep counting for the artist once the clip has left the
 * feed). Saved on the phone (AsyncStorage `community.v1`); nothing here is
 * sent anywhere. Loading the clips themselves is `useCommunityClips`.
 */
type Ctx = {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  /** Shared memories you reported or hid. */
  hidden: ReadonlySet<string>;
  hide: (sharedId: string) => void;
  /** Community clip id -> artist, for clips you've seen. */
  artistOf: Record<string, string>;
  /** Community clips you liked, kept whole for Your clips. */
  kept: Record<string, Clip>;
  /** Remember a community clip's artist; `liked` also keeps the whole clip for Your clips. */
  remember: (clip: Clip, liked?: boolean) => void;
  /** Community clip id -> who shared it, so a like can reach them. */
  owners: Record<string, string>;
  rememberOwner: (clipId: string, uid: string) => void;
  /** Public likes this phone has sent, per account (clip ids). */
  sent: Record<string, string[]>;
  markSent: (account: string, clipId: string, on: boolean) => void;
  /** What was saved has loaded. */
  hydrated: boolean;
};

export const COMMUNITY_STORAGE_KEY = 'community.v1';

const CommunityContext = createContext<Ctx | null>(null);

type Saved = { enabled: boolean; hidden: string[]; artistOf: Record<string, string>; kept: Record<string, Clip>; owners: Record<string, string>; sent: Record<string, string[]> };

function clean(raw: unknown): Saved {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const artistOf: Record<string, string> = {};
  if (o.artistOf && typeof o.artistOf === 'object') {
    for (const [k, v] of Object.entries(o.artistOf as Record<string, unknown>)) if (typeof v === 'string') artistOf[k] = v;
  }
  return {
    enabled: o.enabled !== false,
    hidden: Array.isArray(o.hidden) ? o.hidden.filter((x): x is string => typeof x === 'string').slice(-2000) : [],
    artistOf,
    kept: cleanKept(o.kept),
    owners: strings(o.owners),
    sent: lists(o.sent),
  };
}

const strings = (raw: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'string' && v) out[k] = v;
  return out;
};
const lists = (raw: unknown): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  if (raw && typeof raw === 'object')
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string').slice(-1000);
  return out;
};

export function CommunityProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved>({ enabled: true, hidden: [], artistOf: {}, kept: {}, owners: {}, sent: {} });
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(COMMUNITY_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const s = clean(JSON.parse(raw));
        setSaved((cur) => ({
          enabled: s.enabled && cur.enabled,
          hidden: [...new Set([...s.hidden, ...cur.hidden])],
          artistOf: { ...s.artistOf, ...cur.artistOf },
          kept: { ...s.kept, ...cur.kept },
          owners: { ...s.owners, ...cur.owners },
          sent: { ...s.sent, ...cur.sent },
        }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(saved)).catch(() => {});
  }, [saved]);

  const setEnabled = useCallback((on: boolean) => setSaved((s) => (s.enabled === on ? s : { ...s, enabled: on })), []);
  const hide = useCallback((id: string) => setSaved((s) => (s.hidden.includes(id) ? s : { ...s, hidden: [...s.hidden, id] })), []);
  const remember = useCallback(
    (clip: Clip, liked = false) =>
      setSaved((s) => {
        const artistOf = rememberArtist(s.artistOf, clip.id, [clip.artistId, ...partnersOf(clip)].join(PLAYERS_JOIN));
        const kept = liked && !s.kept[clip.id] ? keepClip(s.kept, clip) : s.kept;
        const owners = clip.source?.provider === 'community' ? withOwner(s.owners, clip.id, clip.source.uid) : s.owners;
        return artistOf === s.artistOf && kept === s.kept && owners === s.owners ? s : { ...s, artistOf, kept, owners };
      }),
    [],
  );
  const rememberOwner = useCallback(
    (clipId: string, uid: string) =>
      setSaved((s) => {
        const owners = withOwner(s.owners, clipId, uid);
        return owners === s.owners ? s : { ...s, owners };
      }),
    [],
  );
  const markSent = useCallback(
    (account: string, clipId: string, on: boolean) =>
      setSaved((s) => {
        const list = s.sent[account] ?? [];
        if (list.includes(clipId) === on) return s;
        return { ...s, sent: { ...s.sent, [account]: on ? [...list, clipId] : list.filter((x) => x !== clipId) } };
      }),
    [],
  );
  const hidden = useMemo(() => new Set(saved.hidden), [saved.hidden]);

  const value = useMemo<Ctx>(
    () => ({ enabled: saved.enabled, setEnabled, hidden, hide, artistOf: saved.artistOf, kept: saved.kept, remember, owners: saved.owners, rememberOwner, sent: saved.sent, markSent, hydrated }),
    [saved.enabled, setEnabled, hidden, hide, saved.artistOf, saved.kept, remember, saved.owners, rememberOwner, saved.sent, markSent, hydrated],
  );
  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}

export function useCommunity() {
  const ctx = useContext(CommunityContext);
  if (!ctx) throw new Error('useCommunity must be used inside CommunityProvider');
  return ctx;
}

/** For the taste engine: the remembered artists, or none outside the provider. */
export function useCommunityArtists(): Record<string, string> {
  return useContext(CommunityContext)?.artistOf ?? NONE;
}
const NONE: Record<string, string> = {};

/**
 * Every clip that can be yours in Your clips: the catalogue's, then the
 * community clips you liked (while you're signed in, and not from anyone
 * you blocked or anything you hid). `find` looks one up by id.
 */
export function useClipPool(): { clips: Clip[]; find: (id: string) => Clip | undefined } {
  const catalog = useCatalog();
  const social = useSocial();
  const { kept, hidden } = useCommunity();
  const { reactions } = useReactions();
  const artistIds = useMemo(() => new Set(catalog.artists.map((a) => a.id)), [catalog.artists]);
  // SoundCloud cards you liked or saved (while the artist still has their page).
  const cardIds = useMemo(() => Object.keys(reactions).filter((id) => isSoundCloudCardId(id) && (reactions[id]?.liked || reactions[id]?.saved)).join('|'), [reactions]);
  return useMemo(() => {
    // Only while signed in: that's when the people you blocked are known.
    const crowd = social.availability.ok && social.user ? keptClips(kept, { artists: artistIds, blocked: social.blocked, hidden }) : [];
    const cards = cardIds ? reactedCards(cardIds.split('|'), catalog, (id) => !!catalog.soundcloudOf(id), new Set()) : [];
    const extra = cards.length ? [...crowd, ...cards] : crowd;
    const clips = extra.length ? [...catalog.clips, ...extra] : catalog.clips;
    const byId = new Map(extra.map((c) => [c.id, c]));
    return { clips, find: (id: string) => catalog.clip(id) ?? byId.get(id) };
  }, [catalog, social.availability.ok, social.user, social.blocked, kept, hidden, artistIds, cardIds]);
}

/** Fetched clips are fresh for this long; after that, coming back to the app or the focus fetches again. */
export const COMMUNITY_FRESH_MS = 5 * 60_000;
const MIX_KEY = '__mix__';
/** A failed first fetch is tried again after this long (on the next focus or return to the app). */
const RETRY_MS = 30_000;
/** Following reads videos from at most this many of the people you follow (each 30 is one more query). */
export const FOLLOWING_FEED_MAX = 300;

/** A short fingerprint of who you follow, so a change of follows fetches afresh. */
function followKey(uids: ReadonlySet<string>) {
  let h = 5381;
  for (const u of [...uids].sort()) for (let i = 0; i < u.length; i++) h = ((h * 33) ^ u.charCodeAt(i)) >>> 0;
  return `__following__:${uids.size}:${h.toString(36)}`;
}

export type CommunityFocus = Festival | 'mix' | 'following' | undefined;

/**
 * Community clips for Discover's focus, ready for the feed: a festival's,
 * everyone's (`'mix'`), or those of the people you follow (`'following'`).
 * Empty when profiles aren't set up or you're signed out; festival and mix
 * clips also need Videos from the crowd switched on (Following is what you
 * chose to see). Fetches once per focus, again when stale, never twice at the
 * same time; a failed fetch keeps what was there. `loaded` is true once
 * there's an answer (or nothing to fetch).
 */
export function useCommunityFeed(
  focus: CommunityFocus,
  /** Festival mode: the festival's videos are the whole feed, whatever the Videos from the crowd switch says. */
  always = false,
): { clips: Clip[]; loaded: boolean } {
  const social = useSocial();
  const { enabled, hidden } = useCommunity();
  const { artists } = useCatalog();
  const following = focus === 'following';
  const key = focus === 'mix' ? MIX_KEY : following ? followKey(social.following) : focus?.id;
  const active = social.availability.ok && !!social.user && (enabled || following || always) && !!key && (!following || social.following.size > 0);
  const [cache, setCache] = useState<Record<string, { at: number; memories: SharedMemory[] }>>({});
  const inflight = useRef<Set<string>>(new Set());
  const [tick, setTick] = useState(0);

  // Coming back to the app refreshes stale clips.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setTick((t) => t + 1));
    return () => sub.remove();
  }, []);

  const uid = social.user?.uid;
  useEffect(() => {
    if (!active || !key || inflight.current.has(key)) return;
    const had = cache[key];
    if (had && Date.now() - had.at < COMMUNITY_FRESH_MS) return;
    inflight.current.add(key);
    const load =
      key === MIX_KEY
        ? social.service.recentMemories(COMMUNITY_MAX * 2)
        : following
          ? social.service.memoriesBy([...social.following].slice(0, FOLLOWING_FEED_MAX), COMMUNITY_MAX * 2)
          : social.service.festivalMemories(key, COMMUNITY_MAX * 2);
    load
      .then((memories) => setCache((c) => ({ ...c, [key]: { at: Date.now(), memories } })))
      // A first fetch that fails shows as empty (so the screen can say so) and may be tried again in half a minute.
      .catch(() => setCache((c) => (c[key] ? c : { ...c, [key]: { at: Date.now() - COMMUNITY_FRESH_MS + RETRY_MS, memories: [] } })))
      .finally(() => inflight.current.delete(key));
  }, [active, key, following, cache, social.service, social.following, tick, uid]);

  const memories = key ? cache[key]?.memories : undefined;
  const artistIds = useMemo(() => new Set(artists.map((a) => a.id)), [artists]);
  const clips = useMemo(() => {
    if (!active || !memories) return EMPTY;
    const festival = focus === 'mix' || following ? undefined : focus;
    // Following shows only people you still follow (an unfollow takes effect at once).
    const list = following ? memories.filter((m) => social.following.has(m.uid)) : memories;
    return communityClips(list, { artists: artistIds, blocked: social.blocked, hidden, me: uid, festival });
  }, [active, memories, artistIds, social.blocked, social.following, hidden, uid, focus, following]);
  return { clips, loaded: !active || !!memories };
}

/** Community clips for Discover's focus (see useCommunityFeed). */
export function useCommunityClips(focus: CommunityFocus): Clip[] {
  return useCommunityFeed(focus).clips;
}
const EMPTY: Clip[] = [];
