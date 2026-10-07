import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkState } from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import {
  CHAT_LATE_MS,
  CHAT_WATCH,
  DELAY_NOTICE_MS,
  deliveryLine,
  chatLines,
  cleanChatOutbox,
  cleanChatRead,
  cleanMessage,
  dueMessages,
  messageFailed,
  messageId,
  messageSent,
  queueMessage,
  unreadCount,
  type ChatLine,
  type ChatOutboxItem,
} from '../features/crews/chat';
import { isOffline } from '../features/offline/status';
import { type CrewMessage, type DirectChat, isDirectRoom } from '../features/social/models';
import { socialErrorKind } from '../features/social/service';
import { MessagesOffError } from '../features/friends/openChat';
import { notifyNow } from '../lib/notifyNow';
import { bumpQuestEvent } from './dailyQuests';
import { useNow } from '../lib/useNow';
import { useCrews } from './crews';
import { rememberLastKnown, useLastKnown } from './lastKnown';
import { useSocial } from './social';
import { t } from '../i18n';

/**
 * Crew chats. Each of your crews' newest messages are followed live while
 * you're signed in. Yours go into an outbox first (AsyncStorage
 * `crewChatOutbox.v1`, this phone only), stamped with when you wrote them,
 * and send themselves whenever there's signal: straight away, when the
 * network comes back, when you come back to the app, and on a timer that
 * backs off. When you last read each chat is kept in `crewChatRead.v1`, so
 * new messages can be counted.
 */
type Ctx = {
  /** Signed in with a profile, profiles set up. */
  ready: boolean;
  /** In at least one crew, so there's a chat to write in. */
  canChat: boolean;
  /** A crew's chat as it reads, oldest first: sent, then yours waiting for signal. */
  linesFor: (crewId: string) => ChatLine[];
  /** The newest message that reached a crew (for its card). */
  latestFor: (crewId: string) => CrewMessage | undefined;
  /** Messages from others since you last read a crew's chat. */
  unreadFor: (crewId: string) => number;
  /** All of them, across your crews. */
  unreadTotal: number;
  /** Write a message; it's in the outbox until it reaches the crew. False when there's nothing to send. */
  send: (crewId: string, text: string) => boolean;
  /** Take back a message: yours, or anyone's in a crew you started. */
  remove: (crewId: string, line: ChatLine) => Promise<void>;
  /** Try a message that was given up again. */
  retry: (id: string) => void;
  /** You've read a crew's chat up to now. */
  markRead: (crewId: string) => void;
  /** Yours waiting for signal in a crew's chat, oldest first. */
  waitingFor: (crewId: string) => ChatOutboxItem[];
  /** Your messages that got through after being held up (the latest per crew). */
  deliveryFor: (crewId: string) => Delivery | undefined;
  dismissDelivery: (crewId: string) => void;
  /** The chat on screen (so a delay isn't also sent as a notification). */
  setOpenChat: (crewId: string | undefined) => void;
  /** Try sending now (the chat's "Try now"). */
  sendNow: () => void;
  /** Your 1-to-1 chats (rooms the functions above take, like a crew's id). */
  directChats: DirectChat[];
  /** Open (or start) the 1-to-1 chat with a friend who follows you back, or with an organizer's account (`org`); its room id. */
  openDirect: (uid: string, org?: string) => Promise<string>;
  /** When each crewmate last read this chat (uid -> ISO, server time). */
  readsFor: (crewId: string) => Record<string, string>;
  /** Has this crew's chat been read from the server yet (or is there no signal to read it with)? */
  loaded: (crewId: string) => boolean;
  /** When a chat was last read from the server (kept on this phone), and whether it's being followed live right now. */
  readFor: (crewId: string) => { at?: number; live: boolean };
};

/** Your messages that got through after waiting for signal. */
export type Delivery = { crewId: string; count: number; heldMs: number; at: number };

export const CHAT_OUTBOX_KEY = 'crewChatOutbox.v1';
export const CHAT_READ_KEY = 'crewChatRead.v1';
/** Read times are kept per account: `uid/crewId`. */
const readKey = (uid: string, crewId: string) => `${uid}/${crewId}`;

const CrewChatContext = createContext<Ctx | null>(null);

export function CrewChatProvider({ children }: { children: ReactNode }) {
  const social = useSocial();
  const { service } = social;
  const uid = social.user?.uid;
  const ready = social.availability.ok && !!uid && !!social.profile;
  const { crews } = useCrews();
  const net = useNetworkState();
  const online = !isOffline(net);
  const blocked = useMemo(() => [...social.blocked], [social.blocked]);

  // --- Your outbox and what you've read, kept on this phone.
  const [outbox, setOutbox] = useState<ChatOutboxItem[]>([]);
  const [read, setRead] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let alive = true;
    void Promise.all([AsyncStorage.getItem(CHAT_OUTBOX_KEY), AsyncStorage.getItem(CHAT_READ_KEY)])
      .then(([o, r]) => {
        if (!alive) return;
        try {
          // Anything written while this loaded is kept too.
          const stored = cleanChatOutbox(o ? JSON.parse(o) : []);
          setOutbox((cur) => [...stored.filter((x) => !cur.some((c) => c.id === x.id)), ...cur]);
        } catch {}
        try {
          const stored = cleanChatRead(r ? JSON.parse(r) : {});
          setRead((cur) => ({ ...stored, ...cur }));
        } catch {}
      })
      .finally(() => alive && setHydrated(true));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (hydrated) void AsyncStorage.setItem(CHAT_OUTBOX_KEY, JSON.stringify(outbox)).catch(() => {});
  }, [outbox, hydrated]);
  useEffect(() => {
    if (hydrated) void AsyncStorage.setItem(CHAT_READ_KEY, JSON.stringify(read)).catch(() => {});
  }, [read, hydrated]);

  // --- Your 1-to-1 chats: rooms like crews, followed live.
  const [direct, setDirect] = useState<{ uid?: string; chats: DirectChat[] }>({ chats: [] });
  useEffect(() => {
    if (!ready) return;
    return service.watchDirectChats(
      (chats) => setDirect({ uid, chats }),
      () => setDirect((d) => ({ uid, chats: d.uid === uid ? d.chats : [] })),
    );
  }, [ready, service, uid]);
  const directChats = useMemo(() => (direct.uid === uid ? direct.chats : []), [direct, uid]);
  const openDirect = useCallback(async (other: string, org?: string) => {
    let id: string;
    try {
      id = await service.openDirectChat(other, org);
    } catch (e) {
      // Refused although you do follow each other: the database isn't ready for messages yet (its rules need an
      // update), so it's not on them to follow you back.
      if (socialErrorKind(e) !== 'network' && uid && social.following.has(other)) {
        const theirs = await service.following(other, 1000).catch(() => [] as string[]);
        if (theirs.includes(uid)) throw new MessagesOffError();
      }
      throw e;
    }
    setDirect((d) => (d.uid === uid && d.chats.some((c) => c.id === id) ? d : { uid, chats: [...(d.uid === uid ? d.chats : []), { id, members: [uid ?? '', other].sort() as [string, string] }] }));
    return id;
  }, [service, uid, social.following]);

  // --- Each crew's (and 1-to-1) chat, followed live.
  const [sent, setSent] = useState<{ uid?: string; byCrew: Record<string, CrewMessage[]> }>({ byCrew: {} });
  const rooms = useMemo(() => [...crews.map((c) => c.id), ...directChats.map((d) => d.id)], [crews, directChats]);
  const crewKey = [...rooms].sort().join(',');
  useEffect(() => {
    if (!ready || !crewKey) return;
    const stops = crewKey.split(',').map((crewId) =>
      service.watchCrewChat(
        crewId,
        CHAT_WATCH,
        (messages) => {
          setSent((s) => ({ uid, byCrew: { ...(s.uid === uid ? s.byCrew : {}), [crewId]: messages } }));
          // Kept on this phone, so the chat still reads with no signal.
          if (uid) rememberLastKnown(uid, { chat: { [crewId]: { value: messages, at: Date.now() } } });
        },
        // Refused (old rules, or no longer in the crew): show what there is rather than loading forever.
        () => setSent((s) => ({ uid, byCrew: { ...(s.uid === uid ? s.byCrew : {}), [crewId]: (s.uid === uid ? s.byCrew[crewId] : undefined) ?? [] } })),
      ),
    );
    return () => stops.forEach((stop) => stop());
  }, [ready, crewKey, service, uid]);
  // When each member last read each chat, followed live, for "Seen by".
  const [readsState, setReads] = useState<{ uid?: string; byCrew: Record<string, Record<string, string>> }>({ byCrew: {} });
  useEffect(() => {
    if (!ready || !crewKey) return;
    const stops = crewKey.split(',').map((crewId) =>
      service.watchCrewReads(crewId, (r) => setReads((s) => ({ uid, byCrew: { ...(s.uid === uid ? s.byCrew : {}), [crewId]: r } })), () => {}),
    );
    return () => stops.forEach((stop) => stop());
  }, [ready, crewKey, service, uid]);
  const readsByCrew = useMemo(() => (readsState.uid === uid ? readsState.byCrew : {}), [readsState, uid]);
  // Your own read receipts: sent when you read, and again once there's signal if that didn't get through.
  const receiptsDue = useRef(new Set<string>());
  const sendReceipts = useCallback(() => {
    if (!ready) return;
    for (const crewId of [...receiptsDue.current]) {
      receiptsDue.current.delete(crewId);
      service.markCrewChatRead(crewId).catch(() => receiptsDue.current.add(crewId));
    }
  }, [ready, service]);
  // Chats not read yet this time (no signal on opening) show what this phone last read.
  const keptChat = useLastKnown(uid)?.chat;
  const liveByCrew = useMemo<Record<string, CrewMessage[]>>(() => (sent.uid === uid ? sent.byCrew : {}), [sent, uid]);
  const byCrew = useMemo<Record<string, CrewMessage[]>>(() => {
    const out: Record<string, CrewMessage[]> = {};
    for (const [room, k] of Object.entries(keptChat ?? {})) out[room] = k.value;
    return { ...out, ...liveByCrew };
  }, [keptChat, liveByCrew]);
  // Another account signing in starts with no read receipts or delivery notes of the last one's.
  useEffect(() => {
    receiptsDue.current.clear();
  }, [uid]);

  // --- Sending: each crew's waiting messages in one small write, oldest crew first.
  const sending = useRef(false);
  const [tick, setTick] = useState(0);
  // Yours that got through after being held up, for the chat to say so.
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const openChat = useRef<string | undefined>(undefined);
  // Waiting messages deleted while they were being sent: taken back as soon as they land.
  const cancelled = useRef(new Set<string>());
  const flush = useCallback(async () => {
    if (!ready || sending.current) return;
    // Only this account's (switching accounts never sends one account's words as another).
    const due = dueMessages(outbox, Date.now()).filter((o) => (!o.uid || o.uid === uid) && rooms.includes(o.crewId));
    if (!due.length) return;
    sending.current = true;
    try {
      const byCrew = new Map<string, ChatOutboxItem[]>();
      for (const o of due) byCrew.set(o.crewId, [...(byCrew.get(o.crewId) ?? []), o]);
      for (const [crewId, items] of byCrew) {
        try {
          const done = new Set(await service.sendCrewMessages(crewId, items.map((o) => ({ id: o.id, text: o.text, at: o.at }))));
          const at = Date.now();
          setOutbox((box) => box.filter((o) => !done.has(o.id)));
          for (const id of done)
            if (cancelled.current.delete(id)) void service.deleteCrewMessage(crewId, id).catch(() => {});
          // Held up by signal: say so once they're through.
          const held = items.filter((o) => done.has(o.id));
          const heldMs = held.length ? at - Math.min(...held.map((o) => Date.parse(o.at))) : 0;
          if (held.length && heldMs >= DELAY_NOTICE_MS) {
            setDeliveries((d) => [...d.filter((x) => x.crewId !== crewId), { crewId, count: held.length, heldMs, at }]);
            if (heldMs >= CHAT_LATE_MS && openChat.current !== crewId)
              void notifyNow(`chat-sent:${crewId}:${at}`, t('Your messages got through'), deliveryLine(held.length, heldMs, isDirectRoom(crewId)),
 `/crew-chat/${crewId}`);
          }
          // Any left over (sent with ones already there) try again on the usual wait.
          for (const o of items) if (!done.has(o.id)) setOutbox((box) => messageFailed(box, o.id, Date.now(), false));
        } catch (e) {
          const kind = socialErrorKind(e);
          const noSignal = kind === 'network' || kind === 'unavailable';
          setOutbox((box) => items.reduce((b, o) => messageFailed(b, o.id, Date.now(), !noSignal), box));
          // No signal: the other crews would fail too.
          if (noSignal) break;
        }
      }
    } finally {
      sending.current = false;
      setTick((t) => t + 1);
    }
  }, [ready, outbox, rooms, service, uid]);

  useEffect(() => {
    if (online) void flush();
  }, [online, flush, tick]);
  useEffect(() => {
    if (online) sendReceipts();
  }, [online, sendReceipts]);
  // Coming back to the app, and the next retry.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void flush();
    });
    return () => sub.remove();
  }, [flush]);
  useEffect(() => {
    const now = Date.now();
    const waits = outbox.map((o) => (o.nextAt ?? 0) - now).filter((w) => w > 0);
    if (!waits.length) return;
    const t = setTimeout(() => setTick((x) => x + 1), Math.min(...waits) + 50);
    return () => clearTimeout(t);
  }, [outbox]);

  const send = useCallback(
    (crewId: string, raw: string) => {
      const text = cleanMessage(raw);
      if (!text || !uid) return false;
      const now = Date.now();
      setOutbox((o) => queueMessage(o, { id: messageId(now), crewId, text, at: new Date(now).toISOString(), tries: 0, uid }));
      // Reading your own words counts as having read the chat.
      setRead((r) => ({ ...r, [readKey(uid, crewId)]: now }));
      bumpQuestEvent('chat');
      return true;
    },
    [uid],
  );
  const retry = useCallback((id: string) => {
    setOutbox((o) => o.map((x) => (x.id === id ? { ...x, tries: 0, refused: 0, nextAt: 0, at: new Date().toISOString() } : x)));
  }, []);
  const remove = useCallback(
    async (crewId: string, line: ChatLine) => {
      if (line.status !== 'sent') {
        if (sending.current) cancelled.current.add(line.id);
        setOutbox((o) => messageSent(o, line.id));
        return;
      }
      await service.deleteCrewMessage(crewId, line.id);
    },
    [service],
  );
  const dismissDelivery = useCallback((crewId: string) => setDeliveries((d) => d.filter((x) => x.crewId !== crewId)), []);
  const setOpenChat = useCallback((crewId: string | undefined) => {
    openChat.current = crewId;
  }, []);
  const sendNow = useCallback(() => {
    setOutbox((o) => o.map((x) => ({ ...x, nextAt: 0 })));
  }, []);
  const markRead = useCallback(
    (crewId: string) => {
      if (!uid) return;
      // The phone's clock may be behind the server's: never mark read before the newest message there.
      const newest = Math.max(0, ...(byCrew[crewId] ?? []).map((m) => Date.parse(m.sentAt)).filter(Number.isFinite));
      setRead((r) => ({ ...r, [readKey(uid, crewId)]: Math.max(Date.now(), newest) }));
      receiptsDue.current.add(crewId);
      sendReceipts();
    },
    [sendReceipts, uid, byCrew],
  );

  const clock = useNow();
  const now = clock.getTime();

  const value = useMemo<Ctx>(() => {
    // Read on this phone, or (another phone, the website, a reinstall) your read mark on the server: whichever is later.
    const lastRead = (crewId: string) => {
      if (!uid) return undefined;
      const here = read[readKey(uid, crewId)];
      const there = Date.parse(readsByCrew[crewId]?.[uid] ?? '');
      return Number.isFinite(there) ? Math.max(here ?? 0, there) : here;
    };
    const unreadFor = (crewId: string) => unreadCount(byCrew[crewId] ?? [], lastRead(crewId), uid, blocked);
    return {
      ready,
      canChat: ready && rooms.length > 0,
      linesFor: (crewId) => chatLines(byCrew[crewId] ?? [], outbox, crewId, uid, blocked, now),
      latestFor: (crewId) => {
        const list = (byCrew[crewId] ?? []).filter((m) => !blocked.includes(m.uid));
        return [...list].sort((a, b) => b.at.localeCompare(a.at))[0];
      },
      unreadFor,
      unreadTotal: rooms.reduce((n, id) => n + unreadFor(id), 0),
      send,
      remove,
      retry,
      markRead,
      directChats,
      openDirect,
      readsFor: (crewId) => readsByCrew[crewId] ?? {},
      loaded: (crewId) => crewId in byCrew || !online,
      readFor: (crewId) => ({ at: keptChat?.[crewId]?.at, live: crewId in liveByCrew && online }),
      waitingFor: (crewId) => outbox.filter((o) => o.crewId === crewId && (!o.uid || o.uid === uid)),
      deliveryFor: (crewId) => deliveries.find((d) => d.crewId === crewId),
      dismissDelivery,
      setOpenChat,
      sendNow,
    };
  }, [ready, byCrew, liveByCrew, keptChat, online, readsByCrew, outbox, uid, blocked, now, read, rooms, directChats, openDirect, send, remove, retry, markRead, deliveries, dismissDelivery, setOpenChat, sendNow]);

  return <CrewChatContext.Provider value={value}>{children}</CrewChatContext.Provider>;
}

const OFF: Ctx = {
  ready: false,
  canChat: false,
  linesFor: () => [],
  latestFor: () => undefined,
  unreadFor: () => 0,
  unreadTotal: 0,
  send: () => false,
  remove: async () => {},
  retry: () => {},
  markRead: () => {},
  readsFor: () => ({}),
  directChats: [],
  openDirect: async () => {
    throw new Error('Chats aren’t available here.');
  },
  loaded: () => false,
  readFor: () => ({ live: false }),
  waitingFor: () => [],
  deliveryFor: () => undefined,
  dismissDelivery: () => {},
  setOpenChat: () => {},
  sendNow: () => {},
};

/** Crew chats; outside the provider (some tests), nothing to read and nowhere to send. */
export function useCrewChat(): Ctx {
  return useContext(CrewChatContext) ?? OFF;
}
