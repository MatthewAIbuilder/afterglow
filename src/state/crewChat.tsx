import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkState } from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import {
  CHAT_WATCH,
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
import type { CrewMessage } from '../features/social/models';
import { socialErrorKind } from '../features/social/service';
import { useNow } from '../lib/useNow';
import { useCrews } from './crews';
import { useSocial } from './social';

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
  /** Has this crew's chat been read from the server yet? */
  loaded: (crewId: string) => boolean;
};

export const CHAT_OUTBOX_KEY = 'crewChatOutbox.v1';
export const CHAT_READ_KEY = 'crewChatRead.v1';

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
          setOutbox(cleanChatOutbox(o ? JSON.parse(o) : []));
        } catch {}
        try {
          setRead(cleanChatRead(r ? JSON.parse(r) : {}));
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

  // --- Each crew's chat, followed live.
  const [sent, setSent] = useState<{ uid?: string; byCrew: Record<string, CrewMessage[]> }>({ byCrew: {} });
  const crewKey = crews
    .map((c) => c.id)
    .sort()
    .join(',');
  useEffect(() => {
    if (!ready || !crewKey) return;
    const stops = crewKey.split(',').map((crewId) =>
      service.watchCrewChat(
        crewId,
        CHAT_WATCH,
        (messages) => setSent((s) => ({ uid, byCrew: { ...(s.uid === uid ? s.byCrew : {}), [crewId]: messages } })),
        () => {},
      ),
    );
    return () => stops.forEach((stop) => stop());
  }, [ready, crewKey, service, uid]);
  const byCrew = useMemo<Record<string, CrewMessage[]>>(() => (sent.uid === uid ? sent.byCrew : {}), [sent, uid]);

  // --- Sending: oldest first, one at a time.
  const sending = useRef(false);
  const [tick, setTick] = useState(0);
  const flush = useCallback(async () => {
    if (!ready || sending.current) return;
    const due = dueMessages(outbox, Date.now()).filter((o) => crews.some((c) => c.id === o.crewId));
    if (!due.length) return;
    sending.current = true;
    try {
      for (const item of due) {
        try {
          await service.sendCrewMessage(item.crewId, { id: item.id, text: item.text, at: item.at });
          setOutbox((o) => messageSent(o, item.id));
        } catch (e) {
          const kind = socialErrorKind(e);
          const noSignal = kind === 'network' || kind === 'unavailable';
          setOutbox((o) => messageFailed(o, item.id, Date.now(), !noSignal));
          // No signal: the rest would fail too.
          if (noSignal) break;
        }
      }
    } finally {
      sending.current = false;
      setTick((t) => t + 1);
    }
  }, [ready, outbox, crews, service]);

  useEffect(() => {
    if (online) void flush();
  }, [online, flush, tick]);
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
      setOutbox((o) => queueMessage(o, { id: messageId(now), crewId, text, at: new Date(now).toISOString(), tries: 0 }));
      // Reading your own words counts as having read the chat.
      setRead((r) => ({ ...r, [crewId]: now }));
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
        setOutbox((o) => messageSent(o, line.id));
        return;
      }
      await service.deleteCrewMessage(crewId, line.id);
    },
    [service],
  );
  const markRead = useCallback((crewId: string) => {
    setRead((r) => ({ ...r, [crewId]: Date.now() }));
  }, []);

  const clock = useNow();
  const now = clock.getTime();

  const value = useMemo<Ctx>(() => {
    const unreadFor = (crewId: string) => unreadCount(byCrew[crewId] ?? [], read[crewId], uid, blocked);
    return {
      ready,
      linesFor: (crewId) => chatLines(byCrew[crewId] ?? [], outbox, crewId, uid, blocked, now),
      latestFor: (crewId) => {
        const list = (byCrew[crewId] ?? []).filter((m) => !blocked.includes(m.uid));
        return [...list].sort((a, b) => b.at.localeCompare(a.at))[0];
      },
      unreadFor,
      unreadTotal: crews.reduce((n, c) => n + unreadFor(c.id), 0),
      send,
      remove,
      retry,
      markRead,
      loaded: (crewId) => crewId in byCrew,
    };
  }, [ready, byCrew, outbox, uid, blocked, now, read, crews, send, remove, retry, markRead]);

  return <CrewChatContext.Provider value={value}>{children}</CrewChatContext.Provider>;
}

const OFF: Ctx = {
  ready: false,
  linesFor: () => [],
  latestFor: () => undefined,
  unreadFor: () => 0,
  unreadTotal: 0,
  send: () => false,
  remove: async () => {},
  retry: () => {},
  markRead: () => {},
  loaded: () => false,
};

/** Crew chats; outside the provider (some tests), nothing to read and nowhere to send. */
export function useCrewChat(): Ctx {
  return useContext(CrewChatContext) ?? OFF;
}
