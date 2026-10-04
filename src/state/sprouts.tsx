import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useNetworkState } from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { isOffline } from '../features/offline/status';
import { socialErrorKind } from '../features/social/service';
import type { Sprout } from '../features/social/models';
import { type Claim, claimsToSend, cleanClaims, cleanGifts, type Gift, giftsToSend, giftsToTakeBack, nextDue, queueClaim, tidy } from '../features/sprouts/outbox';
import {
  cleanBloomed,
  cleanSproutArtist,
  cleanSproutNote,
  type SproutArtist,
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
  WILD_PREFIX,
  wildKind,
} from '../features/sprouts/sprouts';
import { tonightKey } from '../features/tonight/tonight';
import { nightStart } from '../features/care/care';
import { useTonight } from '../features/tonight/useTonight';
import { topSound } from '../features/taste/thisOrThat';
import { notifyNow } from '../lib/notifyNow';
import { useNow } from '../lib/useNow';
import { useCatalog } from './catalog';
import { bumpQuestEvent } from './dailyQuests';
import { useGoing } from './going';
import { useMemories } from './memories';
import { artistSprouts, type ArtistSprout, cleanShown, newArtistSprouts, shownMark } from '../features/sprouts/artistSprouts';
import { useSeen } from './seen';
import { useSocial } from './social';

/**
 * Sprouts: your garden, your seeds and the sprouts you've given, made for
 * bad signal. Everything is kept on the phone (AsyncStorage `sprouts.v1`)
 * the moment it happens; gifts reach Afterglow and scans are picked up as
 * soon as there's signal, trying again by themselves.
 */
export type ClaimResult = 'claimed' | 'waiting' | 'self' | 'taken' | 'gone' | 'signed-out';
export type GiveResult = { card: SproutCard } | { problem: 'no-seeds' | 'needs-profile' | 'signed-out' | 'loading' | 'not-yours' };

type Stored = {
  gifts: Gift[];
  claims: Claim[];
  /** Sprouts you picked up, per account. */
  garden: (GardenSprout & { account: string })[];
  /** Plain sprouts that bloomed, and what into. */
  bloomed: Record<string, SproutKind>;
  /** When each bloomed (for the bell). */
  bloomedAt?: Record<string, number>;
  /** Blooms already celebrated in the garden. */
  bloomsShown?: string[];
  /** Artist sprouts celebrated, per artist: the level shown plus one. */
  artistShown?: Record<string, number>;
  /** When this phone's first sprout arrived. */
  starterAt?: number;
  /** Wild sprouts found at festivals (this phone). */
  wild?: GardenSprout[];
  /** When each festival was first marked going on this phone (0: before sprouts existed). */
  goingSince?: Record<string, number>;
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
  /** Your sprouts that bloomed, and when. */
  blooms: { id: string; kind: SproutKind; at: number }[];
  /** Blooms and wild finds not yet celebrated in the garden, oldest first. */
  newBlooms: { id: string; kind: SproutKind; at: number; foundAt?: string }[];
  /** The garden celebrated this bloom. */
  bloomShown: (id: string) => void;
  /** Artist sprouts you've earned by filming them, most filmed first. */
  artists: ArtistSprout[];
  /** Artist sprouts new or levelled up since the garden last showed them, first earned first. */
  newArtists: ArtistSprout[];
  /** The garden celebrated this artist sprout at its level. */
  artistShown: (s: ArtistSprout) => void;
  /** Scans waiting or done (this account, or not signed in yet). */
  claims: Claim[];
  /** Give a sprout: a kind, or (with `artist`) the sprout of an artist you've filmed. */
  give: (kind: SproutKind, note?: string, artist?: SproutArtist) => GiveResult;
  takeBack: (id: string) => Promise<boolean>;
  claim: (card: SproutCard) => Promise<ClaimResult>;
  /** Read one gift again (while its code is showing): has someone picked it up? */
  checkGift: (id: string) => Promise<void>;
  /** Read what you've given and picked up from Afterglow. */
  refresh: () => Promise<void>;
};

export const SPROUTS_KEY = 'sprouts.v1';
const TRY_TIMEOUT_MS = 10_000;
/** Celebrations already shown, kept at least as long as the wild sprouts and blooms they're for. */
const SHOWN_MAX = 2000;
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
  ).map((g) => {
    const { artist, ...rest } = g;
    const a = cleanSproutArtist(artist);
    return a ? { ...rest, artist: a } : rest;
  });
}

function cleanTimes(raw: unknown, zeroOk = false): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'number' && (zeroOk ? v >= 0 : v > 0) && k.length <= 120) out[k] = v;
  return out;
}

function clean(raw: unknown): Stored {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    gifts: cleanGifts(o.gifts),
    claims: cleanClaims(o.claims),
    garden: cleanGarden(o.garden),
    bloomed: cleanBloomed(o.bloomed),
    bloomedAt: cleanTimes(o.bloomedAt),
    bloomsShown: Array.isArray(o.bloomsShown) ? o.bloomsShown.filter((x): x is string => typeof x === 'string').slice(-SHOWN_MAX) : [],
    ...(o.artistShown && typeof o.artistShown === 'object' ? { artistShown: cleanShown(o.artistShown) } : {}),
    ...(typeof o.starterAt === 'number' ? { starterAt: o.starterAt } : {}),
    ...(o.goingSince && typeof o.goingSince === 'object' ? { goingSince: cleanTimes(o.goingSince, true) } : {}),
    wild: Array.isArray(o.wild)
      ? o.wild.filter((g): g is GardenSprout => !!g && typeof g === 'object' && typeof g.id === 'string' && g.id.startsWith(WILD_PREFIX) && isKind(g.kind) && typeof g.at === 'number').slice(-500)
      : [],
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
  const { going, hydrated: goingLoaded } = useGoing();
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
  // The latest state and account, for async work that outlives a render.
  const storedRef = useRef(stored);
  // Artist sprouts you've earned, for `give` (filled once the list is worked out below).
  const artistsRef = useRef<ArtistSprout[]>([]);
  const accountRef = useRef(account);
  useEffect(() => {
    storedRef.current = stored;
    accountRef.current = account;
  });
  // Ids being sent or picked up right now, so nothing goes twice.
  const inFlight = useRef(new Set<string>());
  // Coming back to the app: a reason to read what's on Afterglow.
  const [back, setBack] = useState(0);

  // A read that failed (not a broken file): nothing is saved over what's there this time.
  const readFailed = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(SPROUTS_KEY)
      .catch((e) => {
        readFailed.current = true;
        throw e;
      })
      .then((raw) => {
        let s: Stored = EMPTY;
        try {
          s = raw ? clean(JSON.parse(raw)) : EMPTY;
        } catch {}
        setStored((cur) => ({
          gifts: [...cur.gifts, ...s.gifts.filter((g) => !cur.gifts.some((c) => c.id === g.id))],
          claims: [...cur.claims, ...s.claims.filter((c) => !cur.claims.some((x) => x.card.id === c.card.id))],
          garden: [...cur.garden, ...s.garden.filter((g) => !cur.garden.some((c) => c.id === g.id && c.account === g.account))],
          bloomed: { ...s.bloomed, ...cur.bloomed },
          bloomedAt: { ...s.bloomedAt, ...cur.bloomedAt },
          bloomsShown: [...new Set([...(s.bloomsShown ?? []), ...(cur.bloomsShown ?? [])])],
          ...(s.artistShown || cur.artistShown ? { artistShown: { ...s.artistShown, ...cur.artistShown } } : {}),
          starterAt: s.starterAt ?? cur.starterAt ?? Date.now(),
          ...(s.goingSince || cur.goingSince ? { goingSince: { ...cur.goingSince, ...s.goingSince } } : {}),
          wild: [...(s.wild ?? []), ...(cur.wild ?? []).filter((w) => !(s.wild ?? []).some((x) => x.id === w.id))],
        }));
      })
      .catch(() => setStored((cur) => ({ ...cur, starterAt: cur.starterAt ?? Date.now() })))
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);
  useEffect(() => {
    if (loaded.current && !readFailed.current) AsyncStorage.setItem(SPROUTS_KEY, JSON.stringify(stored)).catch(() => {});
  }, [stored]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      setTick((t) => t + 1);
      setBack((b) => b + 1);
    });
    return () => sub.remove();
  }, []);

  const gifts = useMemo(() => (account ? stored.gifts.filter((g) => g.account === account && !g.takenBack).sort((a, b) => b.at - a.at) : []), [stored.gifts, account]);
  const claims = useMemo(() => stored.claims.filter((c) => !c.account || c.account === account), [stored.claims, account]);

  // ---- Sending ----------------------------------------------------------
  const sendGift = useCallback(
    async (g: Gift) => {
      inFlight.current.add(g.id);
      try {
        await timeout(
          social.service.giveSprout({
            id: g.id,
            kind: g.kind,
            ...(g.note ? { note: g.note } : {}),
            ...(g.festivalId ? { festivalId: g.festivalId } : {}),
            ...(g.artist ? { artistId: g.artist.id, artistName: g.artist.name } : {}),
          }),
          TRY_TIMEOUT_MS,
        );
        setStored((s) => ({ ...s, gifts: s.gifts.map((x) => (x.id === g.id ? { ...x, sent: true } : x)) }));
      } catch {
        setStored((s) => ({ ...s, gifts: s.gifts.map((x) => (x.id === g.id ? { ...x, tries: x.tries + 1, lastTry: Date.now() } : x)) }));
      } finally {
        inFlight.current.delete(g.id);
      }
    },
    [social.service, setStored],
  );

  const addToGarden = useCallback(
    (card: SproutCard, sprout: Sprout | undefined, me: string, at: number, late?: boolean, scannedAt?: number) =>
      setStored((s) => {
        if (s.garden.some((g) => g.id === card.id && g.account === me)) return s;
        const kind = sprout && isKind(sprout.kind) ? sprout.kind : card.kind;
        // An artist's sprout: the artist the server has, else the one in the code.
        // What the server has wins; the code's artist only counts when the server couldn't be read (a link can be edited).
        const artist = sprout ? (sprout.artistId ? cleanSproutArtist({ id: sprout.artistId, name: sprout.artistName }) : undefined) : cleanSproutArtist(card.artist);
        const entry = { id: card.id, kind, from: card.from, handle: card.handle, name: card.name, at, account: me, ...(artist ? { artist } : {}), ...(sprout?.note ? { note: sprout.note } : {}), ...(late ? { late: true } : {}), ...(scannedAt && scannedAt < at ? { scannedAt } : {}) };
        return { ...s, garden: [entry, ...s.garden] };
      }),
    [setStored],
  );

  const tryClaim = useCallback(
    async (c: Claim, me: string): Promise<ClaimResult> => {
      const done = (state: Claim['state']) =>
        setStored((s) => ({ ...s, claims: s.claims.map((x) => (x.card.id === c.card.id && (!x.account || x.account === me) ? { ...x, account: me, state, doneAt: Date.now() } : x)) }));
      // Scanned while signed out, and it turns out to be one you gave: it's not yours to pick up.
      if (c.card.from === me) {
        setStored((s) => ({ ...s, claims: s.claims.filter((x) => !(x.card.id === c.card.id && (!x.account || x.account === me))) }));
        return 'self';
      }
      if (inFlight.current.has(c.card.id)) return 'waiting';
      inFlight.current.add(c.card.id);
      try {
        const sprout = await timeout(social.service.claimSprout(c.card.id), TRY_TIMEOUT_MS);
        // Scanned while signed out, or waiting for signal: it arrives in the background, so say so.
        const late = c.tries > 0 || !c.account;
        addToGarden(c.card, sprout, me, Date.now(), late, c.at);
        done('claimed');
        if (late) void notifyNow(`sprout:${c.card.id}`, `Your sprout from ${c.card.name} is in your garden`, c.tries > 0 ? 'It went through once there was signal.' : 'It was waiting for you to sign in.', '/garden');
        return 'claimed';
      } catch (e) {
        const kind = socialErrorKind(e);
        if (kind === 'sprout-taken' || kind === 'sprout-gone') {
          done(kind === 'sprout-taken' ? 'taken' : 'gone');
          return kind === 'sprout-taken' ? 'taken' : 'gone';
        }
        setStored((s) => ({ ...s, claims: s.claims.map((x) => (x.card.id === c.card.id && (!x.account || x.account === me) ? { ...x, account: me, tries: x.tries + 1, lastTry: Date.now() } : x)) }));
        return 'waiting';
      } finally {
        inFlight.current.delete(c.card.id);
      }
    },
    [social.service, addToGarden, setStored],
  );

  const noteClaimedRef = useRef<(s: Sprout) => Promise<void>>(async () => {});
  // A gift taken back that may already be on Afterglow: remove it there.
  const removeGift = useCallback(
    async (g: Gift) => {
      inFlight.current.add(g.id);
      try {
        await timeout(social.service.takeBackSprout(g.id), TRY_TIMEOUT_MS);
        setStored((s) => ({ ...s, gifts: s.gifts.filter((x) => x.id !== g.id) }));
      } catch (e) {
        if (socialErrorKind(e) === 'sprout-taken') {
          // Someone picked it up first: it stays given.
          setStored((s) => ({ ...s, gifts: s.gifts.map((x) => (x.id === g.id ? { ...x, takenBack: undefined, sent: true } : x)) }));
          const there = await timeout(social.service.sprout(g.id), TRY_TIMEOUT_MS).catch(() => null);
          if (there?.to) await timeout(noteClaimedRef.current(there), TRY_TIMEOUT_MS).catch(() => {});
        } else setStored((s) => ({ ...s, gifts: s.gifts.map((x) => (x.id === g.id ? { ...x, tries: x.tries + 1, lastTry: Date.now() } : x)) }));
      } finally {
        inFlight.current.delete(g.id);
      }
    },
    [social.service, setStored],
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
    const mine = stored.gifts.filter((g) => g.account === account && !inFlight.current.has(g.id));
    const gifts = ready ? giftsToSend(mine, t) : [];
    const back = giftsToTakeBack(mine, t);
    const toClaim = claimsToSend(stored.claims, account, t).filter((c) => !inFlight.current.has(c.card.id));
    if (!gifts.length && !back.length && !toClaim.length) {
      const at = nextDue(
        ready ? mine : [],
        stored.claims.filter((c) => (!c.account || c.account === account) && !inFlight.current.has(c.card.id)),
      );
      if (at === undefined) return;
      const timer = setTimeout(() => setTick((x) => x + 1), Math.max(500, at - t));
      return () => clearTimeout(timer);
    }
    running.current = true;
    // Each step checks the account is still the one signed in (switching accounts stops the round).
    const same = () => accountRef.current === account;
    (async () => {
      for (const g of gifts) if (same()) await sendGift(g);
      for (const g of back) if (same()) await removeGift(g);
      for (const c of toClaim) if (same()) await tryClaim(c, account);
    })().finally(() => {
      running.current = false;
      setTick((x) => x + 1);
    });
  }, [hydrated, account, ready, online, stored.gifts, stored.claims, sendGift, removeGift, tryClaim, tick]);

  // ---- Reading what's on Afterglow --------------------------------------
  const nameOf = useRef(new Map<string, { handle?: string; name?: string }>());
  const whoIs = useCallback(
    async (uid: string) => {
      if (!nameOf.current.has(uid)) {
        const p = await timeout(social.service.profileOf(uid), TRY_TIMEOUT_MS).catch(() => null);
        nameOf.current.set(uid, p ? { handle: p.handle, name: p.displayName } : {});
      }
      return nameOf.current.get(uid)!;
    },
    [social.service],
  );
  const noteClaimed = useCallback(
    async (s: Sprout) => {
      if (!s.to) return;
      const was = storedRef.current.gifts.find((g) => g.id === s.id);
      if (!was || was.claimedBy) return;
      const who = await whoIs(s.to);
      setStored((st) => ({
        ...st,
        gifts: st.gifts.map((g) => (g.id === s.id && !g.claimedBy ? { ...g, sent: true, takenBack: undefined, claimedBy: { uid: s.to!, ...who }, claimedAt: s.claimedAt ? Date.parse(s.claimedAt) : Date.now() } : g)),
      }));
      if (AppState.currentState !== 'active') void notifyNow(`sprout-given:${s.id}`, `${who.name ?? 'Someone'} picked up your sprout`, 'It’s growing in their garden now.', '/garden');
    },
    [whoIs, setStored],
  );
  useEffect(() => {
    noteClaimedRef.current = noteClaimed;
  }, [noteClaimed]);
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
  }, [hydrated, account, online, refresh, back]);

  const checkGift = useCallback(
    async (id: string) => {
      const s = await social.service.sprout(id).catch(() => null);
      if (s?.to) await noteClaimed(s);
    },
    [social.service, noteClaimed],
  );

  // ---- Giving -----------------------------------------------------------
  // When each festival was marked going: festivals already going when this first ran count from always.
  useEffect(() => {
    if (!hydrated || !goingLoaded) return;
    const since = stored.goingSince;
    const missing = going.filter((id) => !since || since[id] === undefined);
    if (!missing.length && since) return;
    const at = since ? Date.now() : 0;
    void Promise.resolve().then(() => setStored((s) => ({ ...s, goingSince: { ...Object.fromEntries(missing.map((id) => [id, at])), ...s.goingSince } })));
  }, [hydrated, goingLoaded, going, stored.goingSince, setStored]);
  const goingSince = useCallback((id: string) => stored.goingSince?.[id] ?? Number.POSITIVE_INFINITY, [stored.goingSince]);
  // At the festival tonight: going since before tonight began (ticking "I'm going" on the night gives no wild sprout or extra seeds).
  const here = !!tonight && goingSince(tonight.festival.id) < nightStart(tonight.at.getTime());
  const festivalDay = here;
  const seeds = seedsLeft(
    gifts.map((g) => g.at),
    now,
    festivalDay,
  );
  const give = useCallback(
    (kind: SproutKind, note?: string, artist?: SproutArtist): GiveResult => {
      if (!social.user) return { problem: 'signed-out' };
      if (!social.profile) return { problem: 'needs-profile' };
      // Only artists you've filmed, and only an artist the database will take.
      const cleanArtist = artist ? cleanSproutArtist(artist) : undefined;
      if (artist && (!cleanArtist || !artistsRef.current.some((a) => a.artistId === artist.id))) return { problem: 'not-yours' };
      // Seeds are counted from what's saved, so not before it's loaded.
      if (!loaded.current) return { problem: 'loading' };
      const t = Date.now();
      const mine = storedRef.current.gifts.filter((g) => g.account === social.user!.uid && !g.takenBack).map((g) => g.at);
      if (seedsLeft(mine, t, festivalDay) <= 0) return { problem: 'no-seeds' };
      const id = randomId();
      const words = note ? cleanSproutNote(note) : '';
      const gift: Gift = { id, kind, ...(cleanArtist ? { artist: cleanArtist } : {}), at: t, sent: false, tries: 0, account: social.user.uid, ...(words ? { note: words } : {}), ...(tonight ? { festivalId: tonight.festival.id } : {}) };
      storedRef.current = { ...storedRef.current, gifts: [gift, ...storedRef.current.gifts] };
      setStored((s) => ({ ...s, gifts: [gift, ...s.gifts] }));
      bumpQuestEvent('sprout');
      return { card: { id, kind, from: social.user.uid, handle: social.profile.handle, name: social.profile.displayName, ...(cleanArtist ? { artist: cleanArtist } : {}) } };
    },
    [social.user, social.profile, festivalDay, tonight, setStored],
  );

  const takeBack = useCallback(
    async (id: string): Promise<boolean> => {
      const g = storedRef.current.gifts.find((x) => x.id === id);
      if (!g || g.claimedBy) return false;
      // Never tried: it's only on this phone.
      if (!g.sent && g.tries === 0 && !inFlight.current.has(id)) {
        setStored((s) => ({ ...s, gifts: s.gifts.filter((x) => x.id !== id) }));
        return true;
      }
      if (online && !inFlight.current.has(id)) {
        // Picked up in the meantime? Then it stays given.
        const there = await timeout(social.service.sprout(id), TRY_TIMEOUT_MS).catch(() => undefined);
        if (there?.to) {
          await noteClaimed(there);
          return false;
        }
      }
      // It may be on Afterglow (or on its way): taken back now, removed there once there's signal.
      setStored((s) => ({ ...s, gifts: s.gifts.map((x) => (x.id === id ? { ...x, takenBack: true, tries: 0, lastTry: undefined } : x)) }));
      setTick((t) => t + 1);
      return true;
    },
    [online, social.service, noteClaimed, setStored, setTick],
  );

  // ---- Picking up -------------------------------------------------------
  const claim = useCallback(
    async (card: SproutCard): Promise<ClaimResult> => {
      const me = social.user?.uid;
      if (me && card.from === me) return 'self';
      if (me && stored.garden.some((g) => g.id === card.id && g.account === me)) return 'claimed';
      const t = Date.now();
      const existing = stored.claims.find((c) => c.card.id === card.id && (!c.account || c.account === me));
      if (existing && existing.state !== 'waiting') return existing.state === 'claimed' ? 'claimed' : existing.state;
      setStored((s) => ({ ...s, claims: queueClaim(s.claims, card, me, t).map((c) => (c.card.id === card.id && me && !c.account ? { ...c, account: me } : c)) }));
      if (!me) return 'signed-out';
      if (!online) {
        setStored((s) => ({ ...s, claims: s.claims.map((c) => (c.card.id === card.id && c.account === me ? { ...c, tries: Math.max(1, c.tries), lastTry: t } : c)) }));
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
      festivalDays: festivalDaysOf(catalog.festivals, going, now, goingSince),
    };
  }, [seen, catalog, memories, gifts, going, now, goingSince]);

  const sprouts = useMemo<GardenSprout[]>(() => {
    const mine = account ? stored.garden.filter((g) => g.account === account) : [];
    const starter: GardenSprout[] = stored.starterAt ? [{ id: STARTER_ID, kind: 'seedling', from: '', name: 'Afterglow', at: stored.starterAt }] : [];
    return [...mine, ...(stored.wild ?? []), ...starter];
  }, [stored.garden, stored.starterAt, stored.wild, account]);
  // A wild sprout on each festival night you're at (once loaded, so one's never found twice).
  const wildId = tonight && here ? `${WILD_PREFIX}${tonightKey(tonight.festival.id, tonight.at)}` : undefined;
  const wildName = tonight?.festival.name;
  useEffect(() => {
    if (!hydrated || !wildId || !wildName || (stored.wild ?? []).some((w) => w.id === wildId)) return;
    const found: GardenSprout = { id: wildId, kind: wildKind(wildId), from: '', name: wildName, foundAt: wildName, at: Date.now() };
    void Promise.resolve().then(() => setStored((s) => ((s.wild ?? []).some((w) => w.id === wildId) ? s : { ...s, wild: [...(s.wild ?? []), found] })));
  }, [hydrated, wildId, wildName, stored.wild, setStored]);
  const garden = useMemo(() => gardenOf(sprouts, journey, stored.bloomed, now), [sprouts, journey, stored.bloomed, now]);
  // Remember what each plain sprout bloomed into, so it stays that kind.
  useEffect(() => {
    const fresh = newlyBloomed(garden, stored.bloomed);
    if (!Object.keys(fresh).length) return;
    const at = Date.now();
    void Promise.resolve().then(() =>
      setStored((s) => ({ ...s, bloomed: { ...fresh, ...s.bloomed }, bloomedAt: { ...Object.fromEntries(Object.keys(fresh).map((id) => [id, at])), ...s.bloomedAt } })),
    );
  }, [garden, stored.bloomed]);
  const givable = useMemo(() => givableKinds(garden, stored.bloomed), [garden, stored.bloomed]);
  const blooms = useMemo(
    () => garden.flatMap((g) => (stored.bloomed[g.id] && stored.bloomedAt?.[g.id] ? [{ id: g.id, kind: stored.bloomed[g.id], at: stored.bloomedAt[g.id] }] : [])),
    [garden, stored.bloomed, stored.bloomedAt],
  );
  // Blooms and wild finds not yet celebrated in the garden.
  const newBlooms = useMemo(
    () =>
      [...blooms, ...(stored.wild ?? []).map((w) => ({ id: w.id, kind: w.kind, at: w.at, foundAt: w.foundAt }))]
        .filter((b) => !(stored.bloomsShown ?? []).includes(b.id))
        .sort((a, b) => a.at - b.at),
    [blooms, stored.wild, stored.bloomsShown],
  );
  const bloomShown = useCallback(
    (id: string) => setStored((s) => ((s.bloomsShown ?? []).includes(id) ? s : { ...s, bloomsShown: [...(s.bloomsShown ?? []), id].slice(-SHOWN_MAX) })),
    [setStored],
  );
  const collected = useMemo(() => collectedKinds(garden), [garden]);

  // Artist sprouts: one per artist you've filmed, levelling up with more videos.
  const { hydrated: memoriesLoaded } = useMemories();
  const artists = useMemo(() => artistSprouts(memories, (id) => !!catalog.artist(id)), [memories, catalog]);
  useEffect(() => {
    artistsRef.current = artists;
  }, [artists]);
  // The first time this runs, sprouts from videos you already had are taken as seen (no burst of celebrations).
  useEffect(() => {
    if (!hydrated || !memoriesLoaded || stored.artistShown) return;
    // Every artist you've filmed, known to this catalogue or not yet (the hosted one may arrive a moment later).
    const seen = Object.fromEntries(artistSprouts(memories).map((a) => [a.artistId, shownMark(a)]));
    void Promise.resolve().then(() => setStored((s) => (s.artistShown ? s : { ...s, artistShown: seen })));
  }, [hydrated, memoriesLoaded, stored.artistShown, memories, setStored]);
  const newArtists = useMemo(
    () => (stored.artistShown ? newArtistSprouts(artists, stored.artistShown).sort((a, b) => a.firstAt - b.firstAt) : []),
    [artists, stored.artistShown],
  );
  const artistShown = useCallback(
    (a: ArtistSprout) =>
      setStored((s) => ((s.artistShown?.[a.artistId] ?? 0) >= shownMark(a) ? s : { ...s, artistShown: { ...s.artistShown, [a.artistId]: shownMark(a) } })),
    [setStored],
  );

  const value = useMemo<Ctx>(
    () => ({ hydrated, online, ready, festivalDay, seeds, garden, givable, collected, gifts, blooms, newBlooms, bloomShown, artists, newArtists, artistShown, claims, give, takeBack, claim, checkGift, refresh }),
    [hydrated, online, ready, festivalDay, seeds, garden, givable, collected, gifts, blooms, newBlooms, bloomShown, artists, newArtists, artistShown, claims, give, takeBack, claim, checkGift, refresh],
  );
  return <SproutsContext.Provider value={value}>{children}</SproutsContext.Provider>;
}

export function useSprouts(): Ctx {
  const ctx = useContext(SproutsContext);
  if (!ctx) throw new Error('useSprouts must be used inside SproutsProvider');
  return ctx;
}
