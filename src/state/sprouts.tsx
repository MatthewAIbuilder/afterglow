import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useNetworkState } from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { isOffline } from '../features/offline/status';
import { socialErrorKind } from '../features/social/service';
import type { Sprout } from '../features/social/models';
import { type Claim, claimsToSend, cleanClaims, cleanGifts, type Gift, giftsToSend, nextDue, queueClaim, tidy } from '../features/sprouts/outbox';
import {
  cleanBloomed,
  cleanSproutNote,
  collectedKinds,
  festivalDaysOf,
  garden as gardenOf,
  type GardenSprout,
  type GardenView,
  givableKinds,
  isKind,
  type Journey,
  newlyBloomed,
  seedsLeft,
  SPROUT_ID_LENGTH,
  type SproutCard,
  sproutIdFrom,
  type SproutKind,
  STARTER_ID,
} from '../features/sprouts/sprouts';
import { useTonight } from '../features/tonight/useTonight';
import { topSound } from '../features/taste/thisOrThat';
import { notifyNow } from '../lib/notifyNow';
import { useNow } from '../lib/useNow';
import { useCatalog } from './catalog';
import { bumpQuestEvent } from './dailyQuests';
import { useGoing } from './going';
import { useMemories } from './memories';
import { useSeen } from './seen';
import { useSocial } from './social';

/**
 * Sprouts: your garden, your seeds and the sprouts you've given, made for
 * bad signal. Everything is kept on the phone (AsyncStorage `sprouts.v1`)
 * the moment it happens; gifts reach Afterglow and scans are picked up as
 * soon as there's signal, trying again by themselves.
 */
export type ClaimResult = 'claimed' | 'waiting' | 'self' | 'taken' | 'gone' | 'signed-out';
export type GiveResult = { card: SproutCard } | { problem: 'no-seeds' | 'needs-profile' | 'signed-out' };

type Stored = {
  gifts: Gift[];
  claims: Claim[];
  /** Sprouts you picked up, per account. */
  garden: (GardenSprout & { account: string })[];
  /** Plain sprouts that bloomed, and what into. */
  bloomed: Record<string, SproutKind>;
  /** When this phone's first sprout arrived. */
  starterAt?: number;
};

type Ctx = {
  hydrated: boolean;
  online: boolean;
  /** You can give (signed in with a profile). */
  ready: boolean;
  /** A festival day you're at: double seeds. */
  festivalDay: boolean;
  seeds: number;
  /** Your sprouts, newest first, as they are now. */
  garden: GardenView[];
  givable: SproutKind[];
  collected: Set<SproutKind>;
  /** Sprouts you've given (this account), newest first. */
  gifts: Gift[];
  /** Scans waiting or done (this account, or not signed in yet). */
  claims: Claim[];
  give: (kind: SproutKind, note?: string) => GiveResult;
  takeBack: (id: string) => Promise<boolean>;
  claim: (card: SproutCard) => Promise<ClaimResult>;
  /** Read one gift again (while its code is showing): has someone picked it up? */
  checkGift: (id: string) => Promise<void>;
  /** Read what you've given and picked up from Afterglow. */
  refresh: () => Promise<void>;
};

export const SPROUTS_KEY = 'sprouts.v1';
const TRY_TIMEOUT_MS = 10_000;
const EMPTY: Stored = { gifts: [], claims: [], garden: [], bloomed: {} };

function randomId(): string {
  try {
    return sproutIdFrom(Crypto.getRandomBytes(SPROUT_ID_LENGTH));
  } catch {
    return sproutIdFrom(Array.from({ length: SPROUT_ID_LENGTH }, () => Math.floor(Math.random() * 256)));
  }
}

function cleanGarden(raw: unknown): Stored['garden'] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (g): g is Stored['garden'][number] =>
      !!g && typeof g === 'object' && typeof g.id === 'string' && isKind(g.kind) && typeof g.from === 'string' && typeof g.at === 'number' && typeof g.account === 'string',
  );
}

function clean(raw: unknown): Stored {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    gifts: cleanGifts(o.gifts),
    claims: cleanClaims(o.claims),
    garden: cleanGarden(o.garden),
    bloomed: cleanBloomed(o.bloomed),
    ...(typeof o.starterAt === 'number' ? { starterAt: o.starterAt } : {}),
  };
}

const timeout = <T,>(p: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });

const SproutsContext = createContext<Ctx | null>(null);

export function SproutsProvider({ children }: { children: ReactNode }) {
  const social = useSocial();
  const catalog = useCatalog();
  const { going } = useGoing();
  const { seen } = useSeen();
  const { memories } = useMemories();
  const tonight = useTonight();
  const now = useNow().getTime();
  const net = useNetworkState();
  const online = !isOffline(net);
  const [stored, setStored] = useState<Stored>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);
  const [tick, setTick] = useState(0);
  const account = social.user?.uid;
  const ready = social.availability.ok && !!account && !!social.profile;

  useEffect(() => {
    AsyncStorage.getItem(SPROUTS_KEY)
      .then((raw) => {
        const s = raw ? clean(JSON.parse(raw)) : EMPTY;
        setStored((cur) => ({
          gifts: [...cur.gifts, ...s.gifts.filter((g) => !cur.gifts.some((c) => c.id === g.id))],
          claims: [...cur.claims, ...s.claims.filter((c) => !cur.claims.some((x) => x.card.id === c.card.id))],
          garden: [...cur.garden, ...s.garden.filter((g) => !cur.garden.some((c) => c.id === g.id && c.account === g.account))],
          bloomed: { ...s.bloomed, ...cur.bloomed },
          starterAt: s.starterAt ?? cur.starterAt ?? Date.now(),
        }));
      })
      .catch(() => setStored((cur) => ({ ...cur, starterAt: cur.starterAt ?? Date.now() })))
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);
  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(SPROUTS_KEY, JSON.stringify(stored)).catch(() => {});
  }, [stored]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setTick((t) => t + 1));
    return () => sub.remove();
  }, []);

  const gifts = useMemo(() => (account ? stored.gifts.filter((g) => g.account === account).sort((a, b) => b.at - a.at) : []), [stored.gifts, account]);
  const claims = useMemo(() => stored.claims.filter((c) => !c.account || c.account === account), [stored.claims, account]);

  // ---- Sending ----------------------------------------------------------
  const sendGift = useCallback(
    async (g: Gift) => {
      try {
        await timeout(social.service.giveSprout({ id: g.id, kind: g.kind, ...(g.note ? { note: g.note } : {}), ...(g.festivalId ? { festivalId: g.festivalId } : {}) }), TRY_TIMEOUT_MS);
        setStored((s) => ({ ...s, gifts: s.gifts.map((x) => (x.id === g.id ? { ...x, sent: true } : x)) }));
      } catch {
        setStored((s) => ({ ...s, gifts: s.gifts.map((x) => (x.id === g.id ? { ...x, tries: x.tries + 1, lastTry: Date.now() } : x)) }));
      }
    },
    [social.service, setStored],
  );

  const addToGarden = useCallback(
    (card: SproutCard, sprout: Sprout | undefined, me: string, at: number) =>
      setStored((s) => {
        if (s.garden.some((g) => g.id === card.id && g.account === me)) return s;
        const kind = sprout && isKind(sprout.kind) ? sprout.kind : card.kind;
        const entry = { id: card.id, kind, from: card.from, handle: card.handle, name: card.name, at, account: me, ...(sprout?.note ? { note: sprout.note } : {}) };
        return { ...s, garden: [entry, ...s.garden] };
      }),
    [setStored],
  );

  const tryClaim = useCallback(
    async (c: Claim, me: string): Promise<ClaimResult> => {
      const done = (state: Claim['state']) =>
        setStored((s) => ({ ...s, claims: s.claims.map((x) => (x.card.id === c.card.id ? { ...x, account: me, state, doneAt: Date.now() } : x)) }));
      try {
        const sprout = await timeout(social.service.claimSprout(c.card.id), TRY_TIMEOUT_MS);
        addToGarden(c.card, sprout, me, Date.now());
        done('claimed');
        if (c.tries > 0) void notifyNow(`sprout:${c.card.id}`, `Your sprout from ${c.card.name} is in your garden`, 'It went through once there was signal.', '/garden');
        return 'claimed';
      } catch (e) {
        if (socialErrorKind(e) === 'sprout-taken') {
          done('taken');
          return 'taken';
        }
        setStored((s) => ({ ...s, claims: s.claims.map((x) => (x.card.id === c.card.id ? { ...x, account: me, tries: x.tries + 1, lastTry: Date.now() } : x)) }));
        return 'waiting';
      }
    },
    [social.service, addToGarden, setStored],
  );

  const running = useRef(false);
  useEffect(() => {
    if (!hydrated || !account || !online || running.current) return;
    const t = Date.now();
    const tidied = tidy(stored.gifts, stored.claims, t);
    if (tidied.claims.some((c, i) => c !== stored.claims[i]) || tidied.claims.length !== stored.claims.length || tidied.gifts.length !== stored.gifts.length) {
      void Promise.resolve().then(() => setStored((s) => ({ ...s, ...tidy(s.gifts, s.claims, Date.now()) })));
      return;
    }
    const gifts = ready ? giftsToSend(stored.gifts.filter((g) => g.account === account), t) : [];
    const toClaim = claimsToSend(stored.claims, account, t);
    if (!gifts.length && !toClaim.length) {
      const at = nextDue(ready ? stored.gifts.filter((g) => g.account === account) : [], stored.claims.filter((c) => !c.account || c.account === account));
      if (at === undefined) return;
      const timer = setTimeout(() => setTick((x) => x + 1), Math.max(500, at - t));
      return () => clearTimeout(timer);
    }
    running.current = true;
    (async () => {
      for (const g of gifts) await sendGift(g);
      for (const c of toClaim) await tryClaim(c, account);
    })().finally(() => {
      running.current = false;
      setTick((x) => x + 1);
    });
  }, [hydrated, account, ready, online, stored.gifts, stored.claims, sendGift, tryClaim, tick]);

  // ---- Reading what's on Afterglow --------------------------------------
  const nameOf = useRef(new Map<string, { handle?: string; name?: string }>());
  const whoIs = useCallback(
    async (uid: string) => {
      if (!nameOf.current.has(uid)) {
        const p = await social.service.profileOf(uid).catch(() => null);
        nameOf.current.set(uid, p ? { handle: p.handle, name: p.displayName } : {});
      }
      return nameOf.current.get(uid)!;
    },
    [social.service],
  );
  const noteClaimed = useCallback(
    async (s: Sprout) => {
      if (!s.to) return;
      const who = await whoIs(s.to);
      let fresh = false;
      setStored((st) => ({
        ...st,
        gifts: st.gifts.map((g) => {
          if (g.id !== s.id || g.claimedBy) return g;
          fresh = true;
          return { ...g, sent: true, claimedBy: { uid: s.to!, ...who }, claimedAt: s.claimedAt ? Date.parse(s.claimedAt) : Date.now() };
        }),
      }));
      if (fresh && AppState.currentState !== 'active') void notifyNow(`sprout-given:${s.id}`, `${who.name ?? 'Someone'} picked up your sprout`, 'It’s growing in their garden now.', '/garden');
    },
    [whoIs, setStored],
  );
  const refresh = useCallback(async () => {
    if (!account || !social.availability.ok) return;
    const me = account;
    const [given, got] = await Promise.all([social.service.sproutsGiven(100).catch(() => []), social.service.sproutsReceived(200).catch(() => [])]);
    for (const s of given) if (s.to) await noteClaimed(s);
    for (const s of got) {
      const who = await whoIs(s.from);
      addToGarden({ id: s.id, kind: isKind(s.kind) ? s.kind : 'seedling', from: s.from, handle: who.handle ?? '', name: who.name ?? who.handle ?? 'Someone' }, s, me, s.claimedAt ? Date.parse(s.claimedAt) : Date.now());
    }
  }, [account, social.availability.ok, social.service, noteClaimed, whoIs, addToGarden]);
  useEffect(() => {
    if (hydrated && account && online) void Promise.resolve().then(refresh);
  }, [hydrated, account, online, refresh, tick]);

  const checkGift = useCallback(
    async (id: string) => {
      const s = await social.service.sprout(id).catch(() => null);
      if (s?.to) await noteClaimed(s);
    },
    [social.service, noteClaimed],
  );

  // ---- Giving -----------------------------------------------------------
  const festivalDay = !!tonight;
  const seeds = seedsLeft(
    gifts.map((g) => g.at),
    now,
    festivalDay,
  );
  const give = useCallback(
    (kind: SproutKind, note?: string): GiveResult => {
      if (!social.user) return { problem: 'signed-out' };
      if (!social.profile) return { problem: 'needs-profile' };
      const t = Date.now();
      const mine = stored.gifts.filter((g) => g.account === social.user!.uid).map((g) => g.at);
      if (seedsLeft(mine, t, festivalDay) <= 0) return { problem: 'no-seeds' };
      const id = randomId();
      const words = note ? cleanSproutNote(note) : '';
      const gift: Gift = { id, kind, at: t, sent: false, tries: 0, account: social.user.uid, ...(words ? { note: words } : {}), ...(tonight ? { festivalId: tonight.festival.id } : {}) };
      setStored((s) => ({ ...s, gifts: [gift, ...s.gifts] }));
      bumpQuestEvent('sprout');
      return { card: { id, kind, from: social.user.uid, handle: social.profile.handle, name: social.profile.displayName } };
    },
    [social.user, social.profile, stored.gifts, festivalDay, tonight, setStored],
  );

  const takeBack = useCallback(
    async (id: string): Promise<boolean> => {
      const g = stored.gifts.find((x) => x.id === id);
      if (!g || g.claimedBy) return false;
      if (g.sent) {
        // Picked up in the meantime? Then it stays given.
        const there = await social.service.sprout(id).catch(() => undefined);
        if (there?.to) {
          await noteClaimed(there);
          return false;
        }
        try {
          await social.service.takeBackSprout(id);
        } catch {
          return false;
        }
      }
      setStored((s) => ({ ...s, gifts: s.gifts.filter((x) => x.id !== id) }));
      return true;
    },
    [stored.gifts, social.service, noteClaimed, setStored],
  );

  // ---- Picking up -------------------------------------------------------
  const claim = useCallback(
    async (card: SproutCard): Promise<ClaimResult> => {
      const me = social.user?.uid;
      if (me && card.from === me) return 'self';
      if (me && stored.garden.some((g) => g.id === card.id && g.account === me)) return 'claimed';
      const t = Date.now();
      const existing = stored.claims.find((c) => c.card.id === card.id);
      if (existing && existing.state !== 'waiting') return existing.state === 'claimed' ? 'claimed' : existing.state;
      setStored((s) => ({ ...s, claims: queueClaim(s.claims, card, me, t).map((c) => (c.card.id === card.id && me ? { ...c, account: me } : c)) }));
      if (!me) return 'signed-out';
      if (!online) {
        setStored((s) => ({ ...s, claims: s.claims.map((c) => (c.card.id === card.id ? { ...c, tries: Math.max(1, c.tries), lastTry: t } : c)) }));
        return 'waiting';
      }
      const item: Claim = existing ?? { card, account: me, at: t, state: 'waiting', tries: 0 };
      return tryClaim({ ...item, account: me }, me);
    },
    [social.user, stored.garden, stored.claims, online, tryClaim, setStored],
  );

  // ---- Your garden ------------------------------------------------------
  const journey = useMemo<Journey>(() => {
    const watched = Object.entries(seen).map(([id, at]) => {
      const clip = catalog.clip(id);
      return { at, sound: clip ? topSound(catalog.artist(clip.artistId)) : undefined };
    });
    return {
      watched,
      filmed: memories.map((m) => Date.parse(m.capturedAt)).filter((t) => !Number.isNaN(t)),
      gave: gifts.map((g) => g.at),
      festivalDays: festivalDaysOf(catalog.festivals, going, now),
    };
  }, [seen, catalog, memories, gifts, going, now]);

  const sprouts = useMemo<GardenSprout[]>(() => {
    const mine = account ? stored.garden.filter((g) => g.account === account) : [];
    const starter: GardenSprout[] = stored.starterAt ? [{ id: STARTER_ID, kind: 'seedling', from: '', name: 'Afterglow', at: stored.starterAt }] : [];
    return [...mine, ...starter];
  }, [stored.garden, stored.starterAt, account]);
  const garden = useMemo(() => gardenOf(sprouts, journey, stored.bloomed, now), [sprouts, journey, stored.bloomed, now]);
  // Remember what each plain sprout bloomed into, so it stays that kind.
  useEffect(() => {
    const fresh = newlyBloomed(garden, stored.bloomed);
    if (Object.keys(fresh).length) void Promise.resolve().then(() => setStored((s) => ({ ...s, bloomed: { ...fresh, ...s.bloomed } })));
  }, [garden, stored.bloomed]);
  const givable = useMemo(() => givableKinds(garden, stored.bloomed), [garden, stored.bloomed]);
  const collected = useMemo(() => collectedKinds(garden), [garden]);

  const value = useMemo<Ctx>(
    () => ({ hydrated, online, ready, festivalDay, seeds, garden, givable, collected, gifts, claims, give, takeBack, claim, checkGift, refresh }),
    [hydrated, online, ready, festivalDay, seeds, garden, givable, collected, gifts, claims, give, takeBack, claim, checkGift, refresh],
  );
  return <SproutsContext.Provider value={value}>{children}</SproutsContext.Provider>;
}

export function useSprouts(): Ctx {
  const ctx = useContext(SproutsContext);
  if (!ctx) throw new Error('useSprouts must be used inside SproutsProvider');
  return ctx;
}
