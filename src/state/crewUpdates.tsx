import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkState } from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import {
  cleanNote,
  cleanOutbox,
  cleanSentVideos,
  crewStories,
  delivered,
  enqueue,
  failed,
  liveCrews,
  markSeen as seenStory,
  REFUSED_TRIES,
  repliesTo,
  retryDelay,
  stageOf,
  updateId,
  withSentVideo,
  UPDATES_MAX,
  UPDATES_WINDOW_MS,
  type OutboxItem,
  type SentVideos,
  type Story,
} from '../features/crews/updates';
import type { Memory } from '../features/memories/models';
import { isOffline } from '../features/offline/status';
import type { CrewUpdate, CrewUpdateInput, Profile } from '../features/social/models';
import { socialErrorKind } from '../features/social/service';
import { useNow } from '../lib/useNow';
import { useToday } from '../lib/useToday';
import { useCatalog } from './catalog';
import { useCrews } from './crews';
import { useMemories } from './memories';
import { useSocial } from './social';

/**
 * Crew updates: your crewmates' latest videos and check-ins, and your own
 * waiting for signal.
 *
 * Yours go into an outbox (AsyncStorage `crewOutbox.v1`, this phone only)
 * the moment you post, stamped with that moment. It sends itself whenever
 * there's signal: on opening the app, coming back to it, the network
 * returning, and on a timer that backs off. A video also being shared to
 * Discover waits for that upload and points at it, so it goes up once.
 *
 * Theirs are read every `POLL_MS` while the app is open, for crews whose
 * festival isn't over. What you've watched is remembered (`crewSeen.v1`)
 * so new stories glow.
 */
type Ctx = {
  /** Can you post at all: signed in with a profile, profiles set up. */
  ready: boolean;
  /** How many of your crews are at festivals that aren't over (the stories row shows when there's one). */
  crewCount: number;
  /** The festivals of those crews, soonest first. */
  crewFestivals: string[];
  /** One story per crewmate with something new in the last day and a half, fresh first. */
  stories: Story[];
  /** A crew's updates, newest first, yours included. */
  updatesFor: (crewId: string) => CrewUpdate[];
  /** Your updates still waiting for signal, oldest first. */
  outbox: OutboxItem[];
  /** A crewmate's profile, once read. */
  profileOf: (uid: string) => Profile | undefined;
  /** Post a quick check-in to every crew you're in at this festival: its id (it's in the outbox until it reaches them). False when you have no crew there. */
  checkIn: (festivalId: string, words: { note?: string; stage?: string; artistId?: string }) => string | false;
  /** Answer a crewmate's update, in its crew only; waits for signal like a check-in. False when you can't. */
  reply: (update: CrewUpdate, note: string) => boolean;
  /** The replies to an update, oldest first, with yours still waiting for signal at the end. */
  repliesFor: (update: CrewUpdate) => { reply: CrewUpdate; waiting: boolean }[];
  /** Send a tagged video to your crews at its festival (if it's also being shared to Discover, it waits and points at that copy). */
  sendVideo: (memory: Memory) => boolean;
  /** You watched a crewmate's story: it stops glowing until they post something newer. */
  markSeen: (story: Story) => void;
  /** Take back one of your updates (sent, or still waiting). */
  remove: (update: { crewId?: string; id: string }) => Promise<void>;
  refresh: () => Promise<void>;
};

export const OUTBOX_KEY = 'crewOutbox.v1';
export const SEEN_KEY = 'crewSeen.v1';
/** Crew-only videos you uploaded, so they're removed from storage once you're out of the crew. */
export const SENT_VIDEOS_KEY = 'crewVideos.v1';
/** How often crews' updates are read while the app is open. */
export const POLL_MS = 60_000;

const CrewUpdatesContext = createContext<Ctx | null>(null);

export function CrewUpdatesProvider({ children }: { children: ReactNode }) {
  const social = useSocial();
  const { service } = social;
  const uid = social.user?.uid;
  const ready = social.availability.ok && !!uid && !!social.profile;
  const { crews } = useCrews();
  const catalog = useCatalog();
  const mem = useMemories();
  const today = useToday();
  const net = useNetworkState();
  const online = !isOffline(net);

  const live = useMemo(() => liveCrews(crews, (id) => catalog.festival(id), today), [crews, catalog, today]);

  // --- Your outbox and what you've seen, kept on this phone.
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [sentVideos, setSentVideos] = useState<SentVideos>({});
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([AsyncStorage.getItem(OUTBOX_KEY), AsyncStorage.getItem(SEEN_KEY), AsyncStorage.getItem(SENT_VIDEOS_KEY)])
      .then(([o, s, v]) => {
        if (!alive) return;
        try {
          setSentVideos(cleanSentVideos(JSON.parse(v ?? '{}')));
        } catch {}
        try {
          setOutbox(cleanOutbox(JSON.parse(o ?? '[]'), Date.now()));
        } catch {}
        try {
          const parsed = JSON.parse(s ?? '{}');
          if (parsed && typeof parsed === 'object') {
            setSeen(Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === 'number')) as Record<string, number>);
          }
        } catch {}
      })
      .catch(() => {})
      .finally(() => alive && setHydrated(true));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox)).catch(() => {});
  }, [outbox, hydrated]);
  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(SENT_VIDEOS_KEY, JSON.stringify(sentVideos)).catch(() => {});
  }, [sentVideos, hydrated]);

  // Out of a crew (left, removed by the owner, or it ended): your videos there come out of storage too.
  // Each crew is checked with the server first, so a failed read never deletes anything.
  const tidying = useRef(false);
  const sentKey = Object.keys(sentVideos).join('|');
  const crewKey = crews.map((c) => c.id).join('|');
  useEffect(() => {
    if (!ready || !uid || !online || !hydrated || tidying.current) return;
    const gone = Object.keys(sentVideos).filter((id) => !crews.some((c) => c.id === id));
    if (!gone.length) return;
    tidying.current = true;
    (async () => {
      for (const crewId of gone) {
        try {
          const crew = await service.crew(crewId);
          if (crew && crew.members.includes(uid)) continue;
          await service.forgetCrewVideos(crewId, sentVideos[crewId] ?? []);
          setSentVideos((v) => {
            const { [crewId]: _gone, ...rest } = v;
            return rest;
          });
        } catch {
          // No answer: leave it for next time.
        }
      }
    })().finally(() => {
      tidying.current = false;
    });
    // sentKey and crewKey stand for sentVideos and crews.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, uid, online, hydrated, sentKey, crewKey, service]);
  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seen)).catch(() => {});
  }, [seen, hydrated]);

  // --- Everyone's updates, per crew.
  const [updates, setUpdates] = useState<{ uid?: string; byCrew: Record<string, CrewUpdate[]> }>({ byCrew: {} });
  const liveKey = live.map((c) => `${c.id}:${c.members.join(',')}`).join('|');
  const profiles = useRef(new Map<string, Profile | undefined>());
  const [profilesVersion, setProfilesVersion] = useState(0);
  const refresh = useCallback(async () => {
    if (!ready || !uid || !live.length) return;
    const since = Date.now() - UPDATES_WINDOW_MS;
    const read = await Promise.all(
      live.map(async (c) => [c.id, await service.crewUpdates(c.id, since, UPDATES_MAX).catch(() => undefined)] as const),
    );
    setUpdates((s) => {
      const byCrew = s.uid === uid ? { ...s.byCrew } : {};
      // A crew that couldn't be read keeps what it had.
      for (const [id, list] of read) if (list) byCrew[id] = list;
      return { uid, byCrew };
    });
    // Crewmates' names and faces, once each.
    const missing = [...new Set(live.flatMap((c) => c.members))].filter((m) => m !== uid && !profiles.current.has(m));
    if (missing.length) {
      await Promise.all(missing.map(async (m) => profiles.current.set(m, (await service.profileOf(m).catch(() => null)) ?? undefined)));
      setProfilesVersion((v) => v + 1);
    }
    // liveKey stands for `live`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, uid, liveKey, service]);

  useEffect(() => {
    if (!ready || !live.length) return;
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      sub.remove();
    };
  }, [ready, live.length, refresh]);

  // --- Sending: one item at a time, oldest first, whenever there's a chance.
  // The sender reads the latest of these without restarting.
  const outboxRef = useRef(outbox);
  const memRef = useRef(mem.memories);
  const sharingRef = useRef(social.sharing);
  const crewsRef = useRef(crews);
  useEffect(() => {
    outboxRef.current = outbox;
    memRef.current = mem.memories;
    sharingRef.current = social.sharing;
    crewsRef.current = crews;
  }, [outbox, mem.memories, social.sharing, crews]);
  const sending = useRef(false);
  const [retryTick, setRetryTick] = useState(0);

  const flush = useCallback(async () => {
    if (sending.current || !ready || !uid || !online || !hydrated) return;
    sending.current = true;
    try {
      for (const item of outboxRef.current) {
        // Only crews you're still in.
        const crewIds = item.crewIds.filter((id) => crewsRef.current.some((c) => c.id === id && c.members.includes(uid)));
        if (!crewIds.length) {
          setOutbox((o) => delivered(o, item.id, item.crewIds));
          continue;
        }
        let input: CrewUpdateInput | undefined = item.input;
        if (item.input.kind === 'video' && item.memoryId && !item.input.videoUrl) {
          const m = memRef.current.find((x) => x.id === item.memoryId);
          if (!m) {
            // The video was deleted before it could send.
            setOutbox((o) => delivered(o, item.id, item.crewIds));
            continue;
          }
          if (item.memoryId in sharingRef.current) continue; // still uploading to Discover: wait for it
          if (m.sharedId) {
            const shared = await service.sharedMemory(m.sharedId).catch(() => undefined);
            if (shared === undefined) {
              // Couldn't ask (weak signal): try again on the usual back-off, not only when the app reopens.
              setOutbox((o) => failed(o, item.id));
              setTimeout(() => setRetryTick((t) => t + 1), retryDelay(item.tries));
              break;
            }
            input = shared
              ? { ...item.input, videoUrl: shared.videoUrl, thumbUrl: shared.thumbUrl, sharedId: shared.id }
              : { ...item.input, videoUri: mem.uriOf(m.file), thumbUri: m.thumb ? mem.uriOf(m.thumb) : undefined };
          } else {
            input = { ...item.input, videoUri: mem.uriOf(m.file), thumbUri: m.thumb ? mem.uriOf(m.thumb) : undefined };
          }
        }
        const reached: string[] = [];
        let stop = false;
        let refused = false;
        for (const crewId of crewIds) {
          try {
            const posted = await service.postCrewUpdate(crewId, input);
            reached.push(crewId);
            if (input.kind === 'video' && input.videoUri) setSentVideos((v) => withSentVideo(v, crewId, posted.id));
            setUpdates((s) => {
              const list = (s.byCrew[crewId] ?? []).filter((u) => u.id !== posted.id);
              return { uid: s.uid ?? uid, byCrew: { ...s.byCrew, [crewId]: [posted, ...list] } };
            });
          } catch (e) {
            const kind = socialErrorKind(e);
            if (kind === 'network' || kind === 'unavailable') stop = true;
            else refused = true;
            break;
          }
        }
        // Refused too often: let it go rather than hold up everything after it.
        const givenUp = refused && item.tries + 1 >= REFUSED_TRIES ? crewIds : [];
        const gone = [...reached, ...givenUp, ...item.crewIds.filter((id) => !crewIds.includes(id))];
        if (gone.length) setOutbox((o) => delivered(o, item.id, gone));
        if (stop || (refused && !givenUp.length)) {
          setOutbox((o) => failed(o, item.id));
          setTimeout(() => setRetryTick((t) => t + 1), retryDelay(item.tries));
        }
        // No signal: nothing else will get through either. Refused: carry on with the rest.
        if (stop) break;
      }
    } finally {
      sending.current = false;
    }
  }, [ready, uid, online, hydrated, service, mem]);

  // Try whenever something could have changed: new items, signal back, a share finishing, the retry timer.
  const sharingKey = Object.keys(social.sharing).join('|');
  useEffect(() => {
    if (outbox.length) void flush();
  }, [outbox.length, online, sharingKey, retryTick, ready, flush]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && outboxRef.current.length) void flush();
    });
    return () => sub.remove();
  }, [flush]);

  const crewIdsAt = useCallback(
    (festivalId: string) => (uid ? crews.filter((c) => c.festivalId === festivalId && c.members.includes(uid)).map((c) => c.id) : []),
    [crews, uid],
  );

  const checkIn = useCallback(
    (festivalId: string, words: { note?: string; stage?: string; artistId?: string }) => {
      const crewIds = crewIdsAt(festivalId);
      if (!ready || !crewIds.length) return false;
      const now = Date.now();
      const id = updateId(now);
      const note = words.note ? cleanNote(words.note) : undefined;
      const input: CrewUpdateInput = {
        id,
        kind: 'checkin',
        at: new Date(now).toISOString(),
        festivalId,
        ...(note ? { note } : {}),
        ...(words.stage ? { stage: words.stage } : {}),
        ...(words.artistId ? { artistId: words.artistId } : {}),
      };
      setOutbox((o) => enqueue(o, { id, crewIds, input, tries: 0, queuedAt: now }));
      return id;
    },
    [crewIdsAt, ready],
  );

  const reply = useCallback(
    (target: CrewUpdate, words: string) => {
      const note = cleanNote(words);
      const inCrew = !!uid && crews.some((c) => c.id === target.crewId && c.members.includes(uid));
      if (!ready || !inCrew || !note || target.kind === 'reply') return false;
      const now = Date.now();
      const id = updateId(now);
      const input: CrewUpdateInput = { id, kind: 'reply', at: new Date(now).toISOString(), festivalId: target.festivalId, replyTo: target.id, note };
      setOutbox((o) => enqueue(o, { id, crewIds: [target.crewId], input, tries: 0, queuedAt: now }));
      return true;
    },
    [crews, ready, uid],
  );

  const sendVideo = useCallback(
    (m: Memory) => {
      if (!m.festivalId) return false;
      const crewIds = crewIdsAt(m.festivalId);
      if (!ready || !crewIds.length) return false;
      const now = Date.now();
      const id = updateId(now);
      const festival = catalog.festival(m.festivalId);
      const stage = festival ? stageOf(festival, m.artistId) : undefined;
      const input: CrewUpdateInput = {
        id,
        kind: 'video',
        // When it was filmed: that's the time the crew sees.
        at: m.capturedAt,
        festivalId: m.festivalId,
        ...(m.artistId ? { artistId: m.artistId } : {}),
        ...(stage ? { stage } : {}),
        ...(m.durationSec ? { durationSec: Math.round(m.durationSec) } : {}),
        ...(m.width && m.height ? { width: m.width, height: m.height } : {}),
      };
      setOutbox((o) => enqueue(o, { id, crewIds, input, memoryId: m.id, tries: 0, queuedAt: now }));
      return true;
    },
    [crewIdsAt, ready, catalog],
  );

  const markSeen = useCallback((story: Story) => setSeen((s) => seenStory(s, story)), []);

  const remove = useCallback(
    async (u: { crewId?: string; id: string }) => {
      setOutbox((o) => o.filter((i) => i.id !== u.id));
      if (!u.crewId) return;
      await service.deleteCrewUpdate(u.crewId, u.id);
      setUpdates((s) => ({ ...s, byCrew: { ...s.byCrew, [u.crewId!]: (s.byCrew[u.crewId!] ?? []).filter((x) => x.id !== u.id) } }));
    },
    [service],
  );

  const all = useMemo(() => (updates.uid === uid ? live.flatMap((c) => updates.byCrew[c.id] ?? []) : []), [updates, uid, live]);
  // Recomputed each minute, so old updates leave the row on their own.
  const now = useNow().getTime();
  const stories = useMemo(
    () => crewStories(all, live, { me: uid, blocked: [...social.blocked], seen, now }),
    [all, live, uid, social.blocked, seen, now],
  );
  const updatesFor = useCallback(
    (crewId: string) => (updates.uid === uid ? [...(updates.byCrew[crewId] ?? [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)) : []),
    [updates, uid],
  );
  const repliesFor = useCallback(
    (target: CrewUpdate) => {
      const sent = repliesTo(updates.uid === uid ? (updates.byCrew[target.crewId] ?? []) : [], target, [...social.blocked]);
      const pending = outbox
        .filter((o) => o.input.kind === 'reply' && o.input.replyTo === target.id && o.crewIds.includes(target.crewId) && !sent.some((r) => r.id === o.id))
        .map((o) => ({ ...o.input, crewId: target.crewId, uid: uid ?? '', sentAt: o.input.at }) as CrewUpdate);
      return [...sent.map((r) => ({ reply: r, waiting: false })), ...pending.map((r) => ({ reply: r, waiting: true }))];
    },
    [updates, uid, outbox, social.blocked],
  );
  const profileOf = useCallback(
    (m: string) => profiles.current.get(m),
    // profilesVersion marks new profiles read into the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profilesVersion],
  );

  const crewCount = ready ? live.length : 0;
  const crewFestivals = useMemo(() => (ready ? [...new Set(live.map((c) => c.festivalId))] : []), [ready, live]);
  const value = useMemo<Ctx>(
    () => ({ ready, crewCount, crewFestivals, stories, updatesFor, outbox, profileOf, checkIn, reply, repliesFor, sendVideo, markSeen, remove, refresh }),
    [ready, crewCount, crewFestivals, stories, updatesFor, outbox, profileOf, checkIn, reply, repliesFor, sendVideo, markSeen, remove, refresh],
  );
  return <CrewUpdatesContext.Provider value={value}>{children}</CrewUpdatesContext.Provider>;
}

const OFF: Ctx = {
  ready: false,
  crewCount: 0,
  crewFestivals: [],
  stories: [],
  updatesFor: () => [],
  outbox: [],
  profileOf: () => undefined,
  checkIn: () => false,
  reply: () => false,
  repliesFor: () => [],
  sendVideo: () => false,
  markSeen: () => {},
  remove: async () => {},
  refresh: async () => {},
};

/** Crew updates; outside the provider (some tests), nothing and nowhere to send. */
export function useCrewUpdates(): Ctx {
  return useContext(CrewUpdatesContext) ?? OFF;
}
