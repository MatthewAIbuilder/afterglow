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
  refusedOnce,
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
import { CARE_NOTE, careAlerts as alertsOf, cleanNotified, helpBody, helpTitle, myCare as myCareOf, toNotify, withNotified } from '../features/crews/care';
import type { Memory } from '../features/memories/models';
import { isOffline } from '../features/offline/status';
import { keptAt } from '../features/offline/lastKnown';
import type { CrewCare, CrewUpdate, CrewUpdateInput, MeetSpot, Profile } from '../features/social/models';
import { notifyNow } from '../lib/notifyNow';
import { t } from '../i18n';
import { forgetCrewPhoto, keepCrewPhoto } from '../features/crews/photoFile';
import { firstName } from '../features/crews/together';
import { socialErrorKind } from '../features/social/service';
import { useNow } from '../lib/useNow';
import { useToday } from '../lib/useToday';
import { useCatalog } from './catalog';
import { useCrews } from './crews';
import { lastKnownFor, rememberLastKnown } from './lastKnown';
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
  /** Updates given up on this session because a crew kept refusing them. */
  dropped: string[];
  /** A crewmate's profile, once read. */
  profileOf: (uid: string) => Profile | undefined;
  /** Post a quick check-in to every crew you're in at this festival: its id (it's in the outbox until it reaches them). False when you have no crew there. */
  checkIn: (festivalId: string, words: { note?: string; stage?: string; artistId?: string }) => string | false;
  /** A crew's meeting spot, once read. */
  meetSpotFor: (crewId: string) => MeetSpot | undefined;
  /** Set (or, with empty words, clear) a crew's meeting spot. Needs signal: throws when it can't be saved. */
  setMeetSpot: (crewId: string, text: string) => Promise<void>;
  /** "Can't find you": a check-in to every crew you're in at this festival, waiting for signal like any other. */
  callLost: (festivalId: string) => string | false;
  /** "I'm OK" or "come find me" to every crew you're in at this festival; the update's id, or false. */
  sendCare: (festivalId: string, care: CrewCare) => string | false;
  /** A photo to every crew you're in at this festival (crews only, never Discover); the update's id, or false. */
  sendPhoto: (festivalId: string, photo: { uri: string; width?: number; height?: number }, words: { note?: string; stage?: string; artistId?: string }) => Promise<string | false>;
  /** Crewmates asking for help right now, newest first. */
  careAlerts: CrewUpdate[];
  /** Your own latest "I'm OK" / "come find me" (sent or waiting), while it's current. */
  myCare: CrewUpdate | undefined;
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
  /** When crews' updates were last read from the server (or this phone's copy of them, with no signal). */
  readAt?: number;
  /** The last read got through for every crew (false: showing what this phone had). */
  readLive: boolean;
};

export const OUTBOX_KEY = 'crewOutbox.v1';
export const SEEN_KEY = 'crewSeen.v1';
/** Crew-only videos you uploaded, so they're removed from storage once you're out of the crew. */
export const SENT_VIDEOS_KEY = 'crewVideos.v1';
/** How often crews' updates are read while the app is open. */
export const POLL_MS = 60_000;
const NOTIFIED_KEY = 'crewCareNotified.v1';

const CrewUpdatesContext = createContext<Ctx | null>(null);

export function CrewUpdatesProvider({ children }: { children: ReactNode }) {
  const social = useSocial();
  const { service } = social;
  const uid = social.user?.uid;
  const ready = social.availability.ok && !!uid && !!social.profile;
  const { crews, confirmed: crewsConfirmed } = useCrews();
  const catalog = useCatalog();
  const mem = useMemories();
  const today = useToday();
  const net = useNetworkState();
  const online = !isOffline(net);

  const live = useMemo(() => liveCrews(crews, (id) => catalog.festival(id), today), [crews, catalog, today]);

  // --- Your outbox and what you've seen, kept on this phone.
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  // Yours: what this account wrote (the outbox on this phone can hold another account's too).
  const myOutbox = useMemo(() => outbox.filter((o) => o.uid === uid), [outbox, uid]);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [sentVideos, setSentVideos] = useState<SentVideos>({});
  // Updates given up on this session (a crew kept refusing them), so a screen never says they were sent.
  const [dropped, setDropped] = useState<string[]>([]);
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
    // Only this account's videos (kept as "<uid>:<crewId>"; older ones without an account are left alone).
    const mine = `${uid}:`;
    const gone = Object.keys(sentVideos).filter((k) => k.startsWith(mine) && !crews.some((c) => `${mine}${c.id}` === k));
    if (!gone.length) return;
    tidying.current = true;
    (async () => {
      for (const key of gone) {
        const crewId = key.slice(mine.length);
        try {
          const crew = await service.crew(crewId);
          if (crew && crew.members.includes(uid)) continue;
          await service.forgetCrewVideos(crewId, sentVideos[key] ?? []);
          setSentVideos((v) => {
            const { [key]: _gone, ...rest } = v;
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
  // Each crew's meeting spot, read with its updates (a crew that couldn't be read keeps what it had).
  const [meets, setMeets] = useState<{ uid?: string; byCrew: Record<string, MeetSpot | null> }>({ byCrew: {} });
  const liveKey = live.map((c) => `${c.id}:${c.members.join(',')}`).join('|');
  const profiles = useRef(new Map<string, Profile | undefined>());
  // Crewmates shown from this phone's copy: read again once there's signal.
  const keptPeople = useRef(new Set<string>());
  const [profilesVersion, setProfilesVersion] = useState(0);
  // When updates were last read, and whether that read got through for every crew.
  const [readState, setReadState] = useState<{ uid?: string; at?: number; live: boolean }>({ live: false });
  const refresh = useCallback(async () => {
    if (!ready || !uid || !live.length) return;
    const now = Date.now();
    const since = now - UPDATES_WINDOW_MS;
    const read = await Promise.all(
      live.map(async (c) => [c.id, await service.crewUpdates(c.id, since, UPDATES_MAX).catch(() => undefined)] as const),
    );
    // No answer (no signal): what this phone last read stands in (state/lastKnown).
    const kept = read.some(([, list]) => !list) ? await lastKnownFor(uid) : undefined;
    setUpdates((s) => {
      const byCrew = s.uid === uid ? { ...s.byCrew } : {};
      // A crew that couldn't be read keeps what it had, or this phone's copy.
      for (const [id, list] of read) {
        if (list) byCrew[id] = list;
        else if (!byCrew[id] && kept?.updates?.[id]) byCrew[id] = kept.updates[id].value.filter((u) => Date.parse(u.at) >= since);
      }
      return { uid, byCrew };
    });
    const failed = read.filter(([, list]) => !list).map(([id]) => id);
    setReadState((s) => {
      if (!failed.length) return { uid, at: now, live: true };
      const before = s.uid === uid ? s.at : undefined;
      return { uid, at: before ?? keptAt(failed.map((id) => kept?.updates?.[id])), live: false };
    });
    const spots = await Promise.all(live.map(async (c) => [c.id, await service.meetSpot(c.id).catch(() => undefined)] as const));
    setMeets((s) => {
      const byCrew = s.uid === uid ? { ...s.byCrew } : {};
      for (const [id, spot] of spots) {
        if (spot !== undefined) byCrew[id] = spot;
        else if (!(id in byCrew) && kept?.meets && id in kept.meets) byCrew[id] = kept.meets[id];
      }
      return { uid, byCrew };
    });
    // Crewmates' names and faces, once each (with no signal, this phone's copy until they can be read).
    const missing = [...new Set(live.flatMap((c) => c.members))].filter((m) => m !== uid && (!profiles.current.has(m) || keptPeople.current.has(m)));
    const people: Record<string, Profile> = {};
    if (missing.length) {
      const known = (kept ?? (await lastKnownFor(uid)))?.people;
      await Promise.all(
        missing.map(async (m) => {
          try {
            const p = await service.profileOf(m);
            profiles.current.set(m, p ?? undefined);
            keptPeople.current.delete(m);
            if (p) people[m] = p;
          } catch {
            if (known?.[m] && !profiles.current.get(m)) {
              profiles.current.set(m, known[m]);
              keptPeople.current.add(m);
            }
          }
        }),
      );
      setProfilesVersion((v) => v + 1);
    }
    const readUpdates = Object.fromEntries(read.flatMap(([id, list]) => (list ? [[id, { value: list, at: now }]] : [])));
    const readSpots = Object.fromEntries(spots.flatMap(([id, spot]) => (spot !== undefined ? [[id, spot]] : [])));
    if (Object.keys(readUpdates).length || Object.keys(readSpots).length || Object.keys(people).length)
      rememberLastKnown(uid, { updates: readUpdates, meets: readSpots, people });
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
  // Signal back: read straight away rather than at the next minute.
  const wasOffline = useRef(false);
  useEffect(() => {
    if (!online) wasOffline.current = true;
    else if (wasOffline.current) {
      wasOffline.current = false;
      void refresh();
    }
  }, [online, refresh]);
  const readAt = readState.uid === uid ? readState.at : undefined;
  const readLive = readState.uid === uid && readState.live;

  // --- Sending: one item at a time, oldest first, whenever there's a chance.
  // The sender reads the latest of these without restarting.
  const outboxRef = useRef(outbox);
  const memRef = useRef(mem.memories);
  const sharingRef = useRef(social.sharing);
  const waitingRef = useRef(social.waiting);
  const crewsRef = useRef(crews);
  useEffect(() => {
    outboxRef.current = outbox;
    memRef.current = mem.memories;
    sharingRef.current = social.sharing;
    waitingRef.current = social.waiting;
    crewsRef.current = crews;
  }, [outbox, mem.memories, social.sharing, social.waiting, crews]);
  const sending = useRef(false);
  const [retryTick, setRetryTick] = useState(0);

  const flush = useCallback(async () => {
    // Only once your crews have really been read: a list still loading (or left empty by a failed read) would throw the queue away.
    if (sending.current || !ready || !uid || !online || !hydrated || !crewsConfirmed) return;
    sending.current = true;
    try {
      for (const item of outboxRef.current) {
        // Only what this account wrote (another account on this phone sends its own).
        if (item.uid !== uid) continue;
        // Only crews you're still in.
        const crewIds = item.crewIds.filter((id) => crewsRef.current.some((c) => c.id === id && c.members.includes(uid)));
        if (!crewIds.length) {
          setOutbox((o) => delivered(o, item.id, item.crewIds));
          continue;
        }
        let input: CrewUpdateInput | undefined = item.input;
        if (item.input.kind === 'video' && item.memoryId && !item.input.videoUrl) {
          const m = memRef.current.find((x) => x.id === item.memoryId);
          // Your memories haven't been read back yet: wait for them rather than take the video for deleted.
          if (!m && !mem.hydrated) continue;
          if (!m) {
            // The video was deleted before it could send.
            setOutbox((o) => delivered(o, item.id, item.crewIds));
            continue;
          }
          // Still uploading to Discover, or waiting for signal to: wait for it, then point at it.
          if (item.memoryId in sharingRef.current || waitingRef.current.has(item.memoryId)) continue;
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
        const refusedBy: string[] = [];
        for (const crewId of crewIds) {
          try {
            const posted = await service.postCrewUpdate(crewId, input);
            reached.push(crewId);
            if ((input.kind === 'video' && input.videoUri) || input.kind === 'photo') setSentVideos((v) => withSentVideo(v, `${uid}:${crewId}`, posted.id));
            setUpdates((s) => {
              const list = (s.byCrew[crewId] ?? []).filter((u) => u.id !== posted.id);
              return { uid: s.uid ?? uid, byCrew: { ...s.byCrew, [crewId]: [posted, ...list] } };
            });
          } catch (e) {
            const kind = socialErrorKind(e);
            if (kind === 'network' || kind === 'unavailable') {
              stop = true;
              break;
            }
            // This crew refused it; the others can still take it.
            refusedBy.push(crewId);
          }
        }
        // Refused too often (by the crews that refused, never counting tries with no signal): let it go
        // for them rather than hold up everything after it.
        const givenUp = refusedBy.length && (item.refused ?? 0) + 1 >= REFUSED_TRIES ? refusedBy : [];
        const notGoing = [...givenUp, ...item.crewIds.filter((id) => !crewIds.includes(id))];
        if (reached.length || notGoing.length) setOutbox((o) => delivered(delivered(o, item.id, reached), item.id, notGoing, false));
        // A photo that's gone to every crew it can: its kept copy isn't needed any more.
        if (item.input.kind === 'photo' && crewIds.every((c) => reached.includes(c) || notGoing.includes(c))) forgetCrewPhoto(item.input.thumbUri);
        // Nobody got it at all: say so, rather than let it look sent.
        if (givenUp.length && !reached.length && !item.reachedSome && givenUp.length === crewIds.length) setDropped((d) => [...d, item.id]);
        if (stop) {
          setOutbox((o) => failed(o, item.id));
          setTimeout(() => setRetryTick((t) => t + 1), retryDelay(item.tries));
        } else if (refusedBy.length && !givenUp.length) {
          setOutbox((o) => refusedOnce(o, item.id));
          setTimeout(() => setRetryTick((t) => t + 1), retryDelay(item.tries));
        }
        // No signal: nothing else will get through either. Refused: carry on with the rest.
        if (stop) break;
      }
    } finally {
      sending.current = false;
    }
  }, [ready, uid, online, hydrated, service, mem, crewsConfirmed]);

  // Try whenever something could have changed: new items, signal back, a share finishing, the retry timer.
  const sharingKey = [...Object.keys(social.sharing), ...social.waiting].join('|');
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
      setOutbox((o) => enqueue(o, { id, crewIds, input, tries: 0, queuedAt: now, uid }));
      return id;
    },
    [crewIdsAt, ready, uid],
  );

  const callLost = useCallback(
    (festivalId: string) => {
      const crewIds = crewIdsAt(festivalId);
      if (!ready || !crewIds.length) return false;
      const now = Date.now();
      const id = updateId(now);
      const spot = crewIds.map((c) => (meets.uid === uid ? meets.byCrew[c] : undefined)).find((m) => !!m);
      const input: CrewUpdateInput = {
        id,
        kind: 'checkin',
        lost: true,
        at: new Date(now).toISOString(),
        festivalId,
        note: cleanNote(spot ? `Can’t find you. Heading to ${spot.text}` : 'Can’t find you'),
      };
      setOutbox((o) => enqueue(o, { id, crewIds, input, tries: 0, queuedAt: now, uid }));
      return id;
    },
    [crewIdsAt, ready, meets, uid],
  );

  const sendCare = useCallback(
    (festivalId: string, care: CrewCare) => {
      const crewIds = crewIdsAt(festivalId);
      if (!ready || !crewIds.length) return false;
      const now = Date.now();
      const id = updateId(now);
      const input: CrewUpdateInput = { id, kind: 'checkin', care, at: new Date(now).toISOString(), festivalId, note: CARE_NOTE[care] };
      setOutbox((o) => enqueue(o, { id, crewIds, input, tries: 0, queuedAt: now, uid }));
      return id;
    },
    [crewIdsAt, ready, uid],
  );

  const sendPhoto = useCallback(
    async (festivalId: string, photo: { uri: string; width?: number; height?: number }, words: { note?: string; stage?: string; artistId?: string }) => {
      const crewIds = crewIdsAt(festivalId);
      if (!ready || !crewIds.length) return false;
      const now = Date.now();
      const id = updateId(now);
      const kept = await keepCrewPhoto(photo.uri, id);
      const note = words.note ? cleanNote(words.note) : '';
      const input: CrewUpdateInput = {
        id,
        kind: 'photo',
        at: new Date(now).toISOString(),
        festivalId,
        thumbUri: kept,
        ...(note ? { note } : {}),
        ...(words.stage ? { stage: words.stage } : {}),
        ...(words.artistId ? { artistId: words.artistId } : {}),
        ...(photo.width && photo.height ? { width: Math.round(photo.width), height: Math.round(photo.height) } : {}),
      };
      setOutbox((o) => enqueue(o, { id, crewIds, input, tries: 0, queuedAt: now, uid }));
      return id;
    },
    [crewIdsAt, ready, uid],
  );

  const meetSpotFor = useCallback((crewId: string) => (meets.uid === uid ? (meets.byCrew[crewId] ?? undefined) : undefined), [meets, uid]);
  const setMeetSpot = useCallback(
    async (crewId: string, text: string) => {
      const spot = await service.setMeetSpot(crewId, text);
      setMeets((s) => ({ uid, byCrew: { ...(s.uid === uid ? s.byCrew : {}), [crewId]: spot } }));
      if (uid) rememberLastKnown(uid, { meets: { [crewId]: spot } });
    },
    [service, uid],
  );

  const reply = useCallback(
    (target: CrewUpdate, words: string) => {
      const note = cleanNote(words);
      const inCrew = !!uid && crews.some((c) => c.id === target.crewId && c.members.includes(uid));
      if (!ready || !inCrew || !note || target.kind === 'reply') return false;
      const now = Date.now();
      const id = updateId(now);
      const input: CrewUpdateInput = { id, kind: 'reply', at: new Date(now).toISOString(), festivalId: target.festivalId, replyTo: target.id, note };
      setOutbox((o) => enqueue(o, { id, crewIds: [target.crewId], input, tries: 0, queuedAt: now, uid }));
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
      setOutbox((o) => enqueue(o, { id, crewIds, input, memoryId: m.id, tries: 0, queuedAt: now, uid }));
      return true;
    },
    [crewIdsAt, ready, catalog, uid],
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
      const pending = myOutbox
        .filter((o) => o.input.kind === 'reply' && o.input.replyTo === target.id && o.crewIds.includes(target.crewId) && !sent.some((r) => r.id === o.id))
        .map((o) => ({ ...o.input, crewId: target.crewId, uid: uid ?? '', sentAt: o.input.at }) as CrewUpdate);
      return [...sent.map((r) => ({ reply: r, waiting: false })), ...pending.map((r) => ({ reply: r, waiting: true }))];
    },
    [updates, uid, myOutbox, social.blocked],
  );
  const profileOf = useCallback(
    (m: string) => profiles.current.get(m),
    // profilesVersion marks new profiles read into the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profilesVersion],
  );

  const careAlerts = useMemo(() => alertsOf(all, live, { me: uid, blocked: [...social.blocked], now }), [all, live, uid, social.blocked, now]);
  const myCare = useMemo(() => {
    const waiting = myOutbox.filter((o) => o.input.care).map((o) => ({ ...o.input, crewId: o.crewIds[0], uid: uid ?? '', sentAt: o.input.at }) as CrewUpdate);
    return myCareOf([...all, ...waiting], uid, now);
  }, [all, myOutbox, uid, now]);

  // A nudge on this phone, once per call for help (only if notifications are already allowed).
  const [notified, setNotified] = useState<string[] | undefined>();
  useEffect(() => {
    AsyncStorage.getItem(NOTIFIED_KEY)
      .then((raw) => setNotified(cleanNotified(raw ? JSON.parse(raw) : [])))
      .catch(() => setNotified([]));
  }, []);
  useEffect(() => {
    if (!notified) return;
    const fresh = toNotify(careAlerts, notified);
    if (!fresh.length) return;
    for (const u of fresh) {
      const name = (profileOf(u.uid) ? firstName(profileOf(u.uid)!.displayName) : t('Someone in your crew'));
      void notifyNow(`crew-help:${u.id}`, helpTitle(name), helpBody(u), `/crew-story?uid=${encodeURIComponent(u.uid)}`);
    }
    const next = withNotified(notified, fresh.map((u) => u.id));
    Promise.resolve().then(() => setNotified(next));
    AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify(next)).catch(() => {});
  }, [careAlerts, notified, profileOf]);

  const crewCount = ready ? live.length : 0;
  const crewFestivals = useMemo(() => (ready ? [...new Set(live.map((c) => c.festivalId))] : []), [ready, live]);
  const value = useMemo<Ctx>(
    () => ({ ready, crewCount, crewFestivals, stories, updatesFor, outbox: myOutbox, dropped, profileOf, checkIn, callLost, sendCare, sendPhoto, careAlerts, myCare, meetSpotFor, setMeetSpot, reply, repliesFor, sendVideo, markSeen, remove, refresh, readAt, readLive }),
    [ready, crewCount, crewFestivals, stories, updatesFor, myOutbox, dropped, profileOf, checkIn, callLost, sendCare, sendPhoto, careAlerts, myCare, meetSpotFor, setMeetSpot, reply, repliesFor, sendVideo, markSeen, remove, refresh, readAt, readLive],
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
  dropped: [],
  profileOf: () => undefined,
  checkIn: () => false,
  callLost: () => false,
  sendCare: () => false,
  sendPhoto: async () => false,
  careAlerts: [],
  myCare: undefined,
  meetSpotFor: () => undefined,
  setMeetSpot: async () => {},
  reply: () => false,
  repliesFor: () => [],
  sendVideo: () => false,
  markSeen: () => {},
  remove: async () => {},
  refresh: async () => {},
  readLive: false,
};

/** Crew updates; outside the provider (some tests), nothing and nowhere to send. */
export function useCrewUpdates(): Ctx {
  return useContext(CrewUpdatesContext) ?? OFF;
}
