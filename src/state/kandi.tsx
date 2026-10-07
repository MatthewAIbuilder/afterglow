import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useNetworkState } from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isOffline } from '../features/offline/status';
import { type CharmId, cleanNote, cleanWord, isCharm, isPattern, type Kandi, type KandiCard, type PatternId, type PublicKandi } from '../features/kandi/kandi';
import { SPROUT_ID_LENGTH, sproutIdFrom } from '../features/sprouts/sprouts';
import { socialErrorKind } from '../features/social/service';
import { useSocial } from './social';

/**
 * Kandi: what you're giving (kept on this phone the moment you make it, and
 * left in their garden once there's signal, oldest first, trying again by
 * itself) and what's been left in your garden (kept here too, so it shows
 * with no signal). Per account (AsyncStorage `kandi.v1`, put away with the
 * account like the rest).
 */
export const KANDI_KEY = 'kandi.v1';
/** A give refused this many times (not for want of signal) is let go. */
const REFUSED_MAX = 3;
const RECEIVED_MAX = 100;

/** Waiting to be sent: for someone (`to`), or given by code (`open`, `to` empty: whoever picks it up). */
export type PendingKandi = { id: string; to: string; toName: string; open?: true; word: string; beads: PatternId; charm?: CharmId; note?: string; at: number; tries: number; lastTry?: number; refused?: number };

/** A kandi code's id: 20 letters and digits, random. */
function codeId(): string {
  try {
    return sproutIdFrom(Crypto.getRandomBytes(SPROUT_ID_LENGTH));
  } catch {
    return sproutIdFrom(Array.from({ length: SPROUT_ID_LENGTH }, () => Math.floor(Math.random() * 256)));
  }
}
/** Kandi in your garden, with the giver's handle when known. */
export type ReceivedKandi = Kandi & { fromHandle?: string; fromName?: string };

type Stored = { outbox: PendingKandi[]; received: ReceivedKandi[] };
const EMPTY: Stored = { outbox: [], received: [] };

type Ctx = {
  /** Waiting for signal. */
  outbox: PendingKandi[];
  /** In your garden, newest first. */
  received: ReceivedKandi[];
  /** Make kandi for someone: kept now, left in their garden once there's signal. */
  give: (to: { uid: string; name: string }, word: string, beads: PatternId, note?: string, charm?: CharmId) => boolean;
  /** Make kandi given by code: its card (for the QR) straight away; it reaches Afterglow once there's signal, and whoever scans it first picks it up. */
  giveByCode: (word: string, beads: PatternId, note?: string, charm?: CharmId) => KandiCard | undefined;
  /** Take it out of your garden. */
  remove: (id: string) => Promise<boolean>;
  /** Read what's in your garden again. */
  refresh: () => Promise<void>;
  /** As visitors see it in your garden (word, beads, who made it). */
  shown: PublicKandi[];
};

function clean(raw: unknown): Stored {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const outbox = Array.isArray(o.outbox)
    ? o.outbox.filter(
        (k): k is PendingKandi => !!k && typeof k === 'object' && typeof k.id === 'string' && typeof k.to === 'string' && (!!k.to || k.open === true) && !!cleanWord(k.word) && isPattern(k.beads) && typeof k.at === 'number',
      )
    : [];
  const received = Array.isArray(o.received)
    ? o.received.filter((k): k is ReceivedKandi => !!k && typeof k === 'object' && typeof k.id === 'string' && typeof k.from === 'string' && !!cleanWord(k.word) && isPattern(k.beads)).slice(0, RECEIVED_MAX)
    : [];
  return { outbox, received };
}

const KandiContext = createContext<Ctx | null>(null);

export function KandiProvider({ children }: { children: ReactNode }) {
  const social = useSocial();
  const net = useNetworkState();
  const online = !isOffline(net);
  const account = social.user?.uid;
  const [stored, setStored] = useState<Stored>(EMPTY);
  const loaded = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(KANDI_KEY)
      .then((raw) => {
        let s = EMPTY;
        try {
          s = raw ? clean(JSON.parse(raw)) : EMPTY;
        } catch {}
        setStored((cur) => ({ outbox: [...s.outbox, ...cur.outbox.filter((k) => !s.outbox.some((x) => x.id === k.id))], received: cur.received.length ? cur.received : s.received }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, []);
  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(KANDI_KEY, JSON.stringify(stored)).catch(() => {});
  }, [stored]);

  const give = useCallback(
    (to: { uid: string; name: string }, word: string, beads: PatternId, note?: string, charm?: CharmId) => {
      const w = cleanWord(word);
      if (!w || !isPattern(beads) || !account || to.uid === account) return false;
      const n = cleanNote(note);
      const item: PendingKandi = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, to: to.uid, toName: to.name, word: w, beads, ...(isCharm(charm) ? { charm } : {}), ...(n ? { note: n } : {}), at: Date.now(), tries: 0 };
      setStored((s) => ({ ...s, outbox: [...s.outbox, item] }));
      return true;
    },
    [account],
  );

  const giveByCode = useCallback(
    (word: string, beads: PatternId, note?: string, charm?: CharmId): KandiCard | undefined => {
      const w = cleanWord(word);
      const handle = social.profile?.handle;
      if (!w || !isPattern(beads) || !account || !handle) return undefined;
      const n = cleanNote(note);
      const id = codeId();
      setStored((s) => ({ ...s, outbox: [...s.outbox, { id, to: '', toName: '', open: true, word: w, beads, ...(isCharm(charm) ? { charm } : {}), ...(n ? { note: n } : {}), at: Date.now(), tries: 0 }] }));
      return { id, from: account, handle, word: w, beads };
    },
    [account, social.profile?.handle],
  );

  // Sending: oldest first, once there's signal; no signal tries again later, a refusal counts.
  const sending = useRef(false);
  const [tick, setTick] = useState(0);
  const { service } = social;
  useEffect(() => {
    if (!account || !online || !social.profile || sending.current || !stored.outbox.length) return;
    const next = stored.outbox[0];
    // Tried a moment ago: wait (15 s, doubling to 5 min).
    const wait = next.lastTry ? Math.min(5 * 60_000, 15_000 * 2 ** Math.max(0, next.tries - 1)) - (Date.now() - next.lastTry) : 0;
    if (wait > 0) {
      const timer = setTimeout(() => setTick((n) => n + 1), wait);
      return () => clearTimeout(timer);
    }
    sending.current = true;
    const note = { ...(next.note ? { note: next.note } : {}), ...(next.charm ? { charm: next.charm } : {}) };
    void (next.open ? service.leaveOpenKandi({ id: next.id, word: next.word, beads: next.beads, ...note }) : service.giveKandi({ to: next.to, word: next.word, beads: next.beads, ...note }))
      .then(() => setStored((s) => ({ ...s, outbox: s.outbox.filter((x) => x.id !== next.id) })))
      .catch((e: unknown) => {
        const refused = socialErrorKind(e) !== 'network';
        setStored((s) => ({
          ...s,
          outbox: s.outbox
            .map((x) => (x.id === next.id ? { ...x, tries: x.tries + 1, lastTry: Date.now(), ...(refused ? { refused: (x.refused ?? 0) + 1 } : {}) } : x))
            .filter((x) => (x.refused ?? 0) < REFUSED_MAX),
        }));
      })
      .finally(() => {
        sending.current = false;
        setTick((n) => n + 1);
      });
  }, [account, online, social.profile, stored.outbox, service, tick]);

  const refresh = useCallback(async () => {
    if (!account || !social.availability.ok) return;
    const list = await service.myKandi(RECEIVED_MAX).catch(() => undefined);
    if (!list) return;
    const people = new Map<string, { handle?: string; name?: string }>();
    for (const uid of new Set(list.map((k) => k.from))) {
      const p = await service.profileOf(uid).catch(() => null);
      people.set(uid, p ? { handle: p.handle, name: p.displayName } : {});
    }
    setStored((s) => ({
      ...s,
      received: list
        .filter((k) => !social.blocked.has(k.from))
        .map((k) => {
          const who = people.get(k.from);
          return { ...k, ...(who?.handle ? { fromHandle: who.handle } : {}), ...(who?.name ? { fromName: who.name } : {}) };
        }),
    }));
  }, [account, social.availability.ok, social.blocked, service]);
  useEffect(() => {
    if (account && online) void Promise.resolve().then(refresh);
  }, [account, online, refresh]);

  const remove = useCallback(
    async (id: string) => {
      try {
        await service.removeKandi(id);
        setStored((s) => ({ ...s, received: s.received.filter((k) => k.id !== id) }));
        return true;
      } catch {
        return false;
      }
    },
    [service],
  );

  const shown = useMemo(() => stored.received.map((k) => ({ word: k.word, beads: k.beads, ...(k.charm ? { charm: k.charm } : {}), ...(k.fromHandle ? { from: k.fromHandle } : {}) })), [stored.received]);
  const value = useMemo<Ctx>(() => ({ outbox: stored.outbox, received: stored.received, give, giveByCode, remove, refresh, shown }), [stored, give, giveByCode, remove, refresh, shown]);
  return <KandiContext.Provider value={value}>{children}</KandiContext.Provider>;
}

export function useKandi(): Ctx {
  const ctx = useContext(KandiContext);
  if (!ctx) throw new Error('useKandi must be used inside KandiProvider');
  return ctx;
}
