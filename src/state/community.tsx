import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { Clip, Festival } from '../data/models';
import { COMMUNITY_MAX, communityClips, rememberArtist } from '../features/community/clips';
import type { SharedMemory } from '../features/social/models';
import { useCatalog } from './catalog';
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
  remember: (clip: Clip) => void;
};

export const COMMUNITY_STORAGE_KEY = 'community.v1';

const CommunityContext = createContext<Ctx | null>(null);

type Saved = { enabled: boolean; hidden: string[]; artistOf: Record<string, string> };

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
  };
}

export function CommunityProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved>({ enabled: true, hidden: [], artistOf: {} });
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
        }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(saved)).catch(() => {});
  }, [saved]);

  const setEnabled = useCallback((on: boolean) => setSaved((s) => (s.enabled === on ? s : { ...s, enabled: on })), []);
  const hide = useCallback((id: string) => setSaved((s) => (s.hidden.includes(id) ? s : { ...s, hidden: [...s.hidden, id] })), []);
  const remember = useCallback(
    (clip: Clip) =>
      setSaved((s) => {
        const next = rememberArtist(s.artistOf, clip.id, clip.artistId);
        return next === s.artistOf ? s : { ...s, artistOf: next };
      }),
    [],
  );
  const hidden = useMemo(() => new Set(saved.hidden), [saved.hidden]);

  const value = useMemo<Ctx>(
    () => ({ enabled: saved.enabled, setEnabled, hidden, hide, artistOf: saved.artistOf, remember }),
    [saved.enabled, setEnabled, hidden, hide, saved.artistOf, remember],
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

/** Fetched clips are fresh for this long; after that, coming back to the app or the focus fetches again. */
export const COMMUNITY_FRESH_MS = 5 * 60_000;
const MIX_KEY = '__mix__';

/**
 * Community clips for Discover's focus (a festival, or `'mix'` for every
 * festival), ready for the feed. Empty when profiles aren't set up, you're
 * signed out, or you switched them off. Fetches once per focus, again when
 * stale, never twice at the same time; a failed fetch keeps what was there.
 */
export function useCommunityClips(focus: Festival | 'mix' | undefined): Clip[] {
  const social = useSocial();
  const { enabled, hidden } = useCommunity();
  const { artists } = useCatalog();
  const key = focus === 'mix' ? MIX_KEY : focus?.id;
  const active = social.availability.ok && !!social.user && enabled && !!key;
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
    const load = key === MIX_KEY ? social.service.recentMemories(COMMUNITY_MAX * 2) : social.service.festivalMemories(key, COMMUNITY_MAX * 2);
    load
      .then((memories) => setCache((c) => ({ ...c, [key]: { at: Date.now(), memories } })))
      .catch(() => {})
      .finally(() => inflight.current.delete(key));
  }, [active, key, cache, social.service, tick, uid]);

  const memories = key ? cache[key]?.memories : undefined;
  const artistIds = useMemo(() => new Set(artists.map((a) => a.id)), [artists]);
  return useMemo(() => {
    if (!active || !memories) return EMPTY;
    return communityClips(memories, { artists: artistIds, blocked: social.blocked, hidden, me: uid, festival: focus === 'mix' ? undefined : focus });
  }, [active, memories, artistIds, social.blocked, hidden, uid, focus]);
}
const EMPTY: Clip[] = [];
