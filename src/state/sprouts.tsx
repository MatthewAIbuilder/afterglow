import AsyncStorage from '@react-native-async-storage/async-storage';
import { backupText, readBackup } from '../features/sprouts/backup';
import * as Crypto from 'expo-crypto';
import { useNetworkState } from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { isOffline } from '../features/offline/status';
import { t } from '../i18n';
import { socialErrorKind } from '../features/social/service';
import type { Sprout } from '../features/social/models';
import { type Claim, claimsToSend, cleanClaims, cleanGifts, type Gift, GIFT_REFUSED_MAX, giftsToSend, giftsToTakeBack, giftTried, nextDue, queueClaim, seedGifts, tidy } from '../features/sprouts/outbox';
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
import { canGiveThemes, giftThemesOf, isGiftTheme, type ThemeGift } from '../features/themes/gifts';
import type { ThemeId } from '../theme/palettes';

/**
 * Sprouts: your garden, your seeds and the sprouts you've given, made for
 * bad signal. Everything is kept on the phone (AsyncStorage `sprouts.v1`)
 * the moment it happens; gifts reach Afterglow and scans are picked up as
 * soon as there's signal, trying again by themselves.
 */
export type ClaimResult = 'claimed' | 'waiting' | 'self' | 'taken' | 'gone' | 'signed-out';
export type GiveResult = { card: SproutCard } | { problem: 'no-seeds' | 'needs-profile' | 'signed-out' | 'loading' | 'not-yours' };

export type Stored = {
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
  /** Your garden isn't shown on your profile (it is unless you say). */
  gardenHidden?: true;
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
  /** Gift themes this account has (features/themes/gifts.ts), first given first. */
  giftThemes: (ThemeGift & { granted: boolean; wearOnArrival?: boolean; shown: boolean })[];
  /** The theme page showed this gift (by its sprout). */
  giftThemeShown: (sproutId: string) => void;
  /** Sprouts that arrived in the background (after signing up, or once there was signal) whose page hasn't been shown yet: it offers to follow the giver. */
  toAskFollow: GardenSprout[];
  /** Its page was shown. */
  followAsked: (sproutId: string) => void;
  /** Your garden is shown on your profile (anyone signed in can visit it). */
  gardenShown: boolean;
  setGardenShown: (on: boolean) => void;
  /** Give a sprout: a kind, or (with `artist`) the sprout of an artist you've filmed; the developer can add a gift theme. */
  give: (kind: SproutKind, note?: string, artist?: SproutArtist, theme?: ThemeId) => GiveResult;
  takeBack: (id: string) => Promise<boolean>;
  claim: (card: SproutCard) => Promise<ClaimResult>;
  /** Read one gift again (while its code is showing): has someone picked it up? */
  checkGift: (id: string) => Promise<void>;
  /** Read what you've given and picked up from Afterglow. */
  refresh: () => Promise<void>;
};

export const SPROUTS_KEY = 'sprouts.v1';
// Longer than the backend's own wait for a write (12 s, then a read), so its answer comes first.
const TRY_TIMEOUT_MS = 15_000;
/** Changes settle this long before your garden's private copy is updated. */
const BACKUP_SETTLE_MS = 5000;
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
    const { artist, theme, themeGranted, wearOnArrival, themeShown, followAsked, ...rest } = g;
    const a = cleanSproutArtist(artist);
    const gift = isGiftTheme(theme) ? { theme, ...(themeGranted === true ? { themeGranted } : {}), ...(wearOnArrival === true ? { wearOnArrival } : {}), ...(themeShown === true ? { themeShown } : {}) } : {};
    return { ...rest, ...(a ? { artist: a } : {}), ...gift, ...(followAsked === true ? { followAsked } : {}) };
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
    ...(o.gardenHidden === true ? { gardenHidden: true as const } : {}),
    wild: Array.isArray(o.wild)
      ? o.wild.filter((g): g is GardenSprout => !!g && typeof g === 'object' && typeof g.id === 'string' && g.id.startsWith(WILD_PREFIX) && isKind(g.kind) && typeof g.at === 'number').slice(-500)
      : [],
  };
}

/**
 * Two saved gardens as one: everything in either is kept (sprouts, gifts and
 * wild finds by id, blooms, celebrations), and `cur` wins where both have the
 * same thing. Used when the phone's file loads and when your account's private
 * copy is read back, so neither ever takes anything away.
 */
export function mergeStored(cur: Stored, s: Stored): Stored {
  const starts = [cur.starterAt, s.starterAt].filter((x): x is number => typeof x === 'number');
  return {
    gifts: [...cur.gifts, ...s.gifts.filter((g) => !cur.gifts.some((c) => c.id === g.id))],
    claims: [...cur.claims, ...s.claims.filter((c) => !cur.claims.some((x) => x.card.id === c.card.id))],
    garden: [...cur.garden, ...s.garden.filter((g) => !cur.garden.some((c) => c.id === g.id && c.account === g.account))],
    bloomed: { ...s.bloomed, ...cur.bloomed },
    bloomedAt: { ...s.bloomedAt, ...cur.bloomedAt },
    bloomsShown: [...new Set([...(s.bloomsShown ?? []), ...(cur.bloomsShown ?? [])])],
    ...(s.artistShown || cur.artistShown ? { artistShown: maxShown(s.artistShown, cur.artistShown) } : {}),
    ...(starts.length ? { starterAt: Math.min(...starts) } : {}),
    ...(s.goingSince || cur.goingSince ? { goingSince: { ...cur.goingSince, ...s.goingSince } } : {}),
    ...(s.gardenHidden || cur.gardenHidden ? { gardenHidden: true as const } : {}),
    wild: [...(s.wild ?? []), ...(cur.wild ?? []).filter((w) => !(s.wild ?? []).some((x) => x.id === w.id))],
  };
}

const maxShown = (a: Record<string, number> = {}, b: Record<string, number> = {}) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
};

/** What of a saved garden goes in an account's private copy: its own sprouts and gifts (sent ones: unsent ones are still on their way), plus this phone's wild finds and first sprout. */
export function backupFor(s: Stored, account: string): string | undefined {
  const garden = s.garden.filter((g) => g.account === account);
  const ids = new Set([...garden.map((g) => g.id), ...(s.wild ?? []).map((w) => w.id), STARTER_ID]);
  const pick = <T,>(o: Record<string, T> | undefined) => (o ? Object.fromEntries(Object.entries(o).filter(([k]) => ids.has(k))) : undefined);
  return backupText({
    garden,
    gifts: s.gifts.filter((g) => g.account === account && g.sent && !g.takenBack),
    bloomed: pick(s.bloomed) ?? {},
    bloomedAt: pick(s.bloomedAt),
    bloomsShown: s.bloomsShown,
    artistShown: s.artistShown,
    starterAt: s.starterAt,
    wild: s.wild,
  });
}

/** An account's private copy read back as a saved garden (its sprouts and gifts filed under that account), or undefined. */
export function restoreFrom(text: string | null | undefined, account: string): Stored | undefined {
  const o = readBackup(text);
  if (!o) return undefined;
  const s = clean(o);
  return {
    ...s,
    claims: [],
    garden: s.garden.map((g) => ({ ...g, account })),
    gifts: s.gifts.map((g) => ({ ...g, account })),
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

/** A try that failed for want of signal (or no answer in time), not a refusal. */
const noSignal = (e: unknown) => (e instanceof Error && e.message === 'timeout') || socialErrorKind(e) === 'network';

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
  // A brand-new account (no profile yet, or one made in the last half hour): a gift theme goes straight on.
  const profileRef = useRef({ status: social.profileStatus, profile: social.profile });
  useEffect(() => {
    profileRef.current = { status: social.profileStatus, profile: social.profile };
  });
  const newAccountRef = useRef(() => {
    const { status, profile } = profileRef.current;
    if (status !== 'ready') return false;
    return !profile || Date.now() - Date.parse(profile.createdAt) < 30 * 60_000;
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
        setStored((cur) => ({ ...mergeStored(cur, s), starterAt: s.starterAt ?? cur.starterAt ?? Date.now() }));
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
  // ---- Your account's private copy ---------------------------------------
  // Read back once per account (and merged in, so a new phone, a cleared
  // browser or a reinstall gets its garden back); only then kept up to date,
  // so an empty phone never writes over a full copy.
  const backupRead = useRef<Record<string, 'reading' | 'read' | 'refused'>>({});
  const backupSent = useRef<Record<string, string>>({});
  const [backupReady, setBackupReady] = useState<string | undefined>();
  useEffect(() => {
    if (!hydrated || !account || !social.availability.ok || !online || backupRead.current[account]) return;
    const me = account;
    backupRead.current[me] = 'reading';
    social.service
      .gardenBackup()
      .then((text) => {
        const s = restoreFrom(text, me);
        if (s) setStored((cur) => mergeStored(cur, s));
        if (text) backupSent.current[me] = text;
        backupRead.current[me] = 'read';
        if (accountRef.current === me) setBackupReady(me);
      })
      .catch((e) => {
        // No signal: try again when there is. Refused: leave the copy alone this time.
        if (noSignal(e)) delete backupRead.current[me];
        else backupRead.current[me] = 'refused';
      });
  }, [hydrated, account, online, social.availability.ok, social.service, back]);
  const backup = useMemo(() => (account && backupReady === account ? backupFor(stored, account) : undefined), [stored, account, backupReady]);
  useEffect(() => {
    if (!account || !backup || !online || backupSent.current[account] === backup || backupRead.current[account] !== 'read') return;
    const me = account;
    const timer = setTimeout(() => {
      social.service
        .saveGardenBackup(backup)
        .then(() => {
          backupSent.current[me] = backup;
        })
        .catch(() => {});
    }, BACKUP_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [account, backup, online, social.service]);

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
            ...(g.theme ? { theme: g.theme } : {}),
          }),
          TRY_TIMEOUT_MS,
        );
        setStored((s) => ({ ...s, gifts: s.gifts.map((x) => (x.id === g.id ? { ...x, sent: true } : x)) }));
      } catch (e) {
        // No signal: tried again later. Refused: given up after a few tries, and its seed is back.
        const refused = !noSignal(e);
        setStored((s) => ({ ...s, gifts: s.gifts.map((x) => (x.id === g.id ? giftTried(x, refused, Date.now()) : x)) }));
      } finally {
        inFlight.current.delete(g.id);
      }
    },
    [social.service, setStored],
  );

  const addToGarden = useCallback(
    (card: SproutCard, sprout: Sprout | undefined, me: string, at: number, late?: boolean, scannedAt?: number, newAccount?: boolean) =>
      setStored((s) => {
        // A gift theme only the server can say came with it (a link can be edited).
        const theme = sprout && isGiftTheme(sprout.theme) ? sprout.theme : undefined;
        const there = s.garden.find((g) => g.id === card.id && g.account === me);
        if (there) return theme && !there.theme ? { ...s, garden: s.garden.map((g) => (g === there ? { ...g, theme } : g)) } : s;
        const kind = sprout && isKind(sprout.kind) ? sprout.kind : card.kind;
        // An artist's sprout: the artist the server has, else the one in the code.
        // What the server has wins; the code's artist only counts when the server couldn't be read (a link can be edited).
        const artist = sprout ? (sprout.artistId ? cleanSproutArtist({ id: sprout.artistId, name: sprout.artistName }) : undefined) : cleanSproutArtist(card.artist);
        const entry = { id: card.id, kind, from: card.from, handle: card.handle, name: card.name, at, account: me, ...(artist ? { artist } : {}), ...(sprout?.note ? { note: sprout.note } : {}), ...(late ? { late: true } : {}), ...(scannedAt && scannedAt < at ? { scannedAt } : {}), ...(theme ? { theme, ...(newAccount ? { wearOnArrival: true as const } : {}) } : {}) };
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
        // The server says you gave it (whatever the link said): it isn't yours to pick up.
        if (sprout.from === me) {
          setStored((s) => ({ ...s, claims: s.claims.filter((x) => !(x.card.id === c.card.id && (!x.account || x.account === me))) }));
          return 'self';
        }
        // Scanned while signed out, or waiting for signal: it arrives in the background, so say so.
        const late = c.tries > 0 || !c.account;
        addToGarden(c.card, sprout, me, Date.now(), late, c.at, newAccountRef.current());
        done('claimed');
        if (late) void notifyNow(`sprout:${c.card.id}`, t('Your sprout from {name} is in your garden', { name: c.card.name }), c.tries > 0 ? t('It went through once there was signal.') : t('It was waiting for you to sign in.'), '/garden');
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
        } else if (socialErrorKind(e) === 'not-found' || (!noSignal(e) && (g.refused ?? 0) + 1 >= GIFT_REFUSED_MAX)) {
          // Not yours, or refused again and again: it's already taken back on this phone, so stop asking.
          setStored((s) => ({ ...s, gifts: s.gifts.filter((x) => x.id !== g.id) }));
        } else setStored((s) => ({ ...s, gifts: s.gifts.map((x) => (x.id === g.id ? giftTried(x, !noSignal(e), Date.now()) : x)) }));
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
      if (AppState.currentState !== 'active') void notifyNow(`sprout-given:${s.id}`, who.name != null ? t('{name} picked up your sprout', { name: who.name }) : t('Someone picked up your sprout'), t('It’s growing in their garden now.'), '/garden');
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
    seedGifts(gifts).map((g) => g.at),
    now,
    festivalDay,
  );
  const give = useCallback(
    (kind: SproutKind, note?: string, artist?: SproutArtist, theme?: ThemeId): GiveResult => {
      if (!social.user) return { problem: 'signed-out' };
      if (!social.profile) return { problem: 'needs-profile' };
      // Only artists you've filmed, and only an artist the database will take.
      const cleanArtist = artist ? cleanSproutArtist(artist) : undefined;
      if (artist && (!cleanArtist || !artistsRef.current.some((a) => a.artistId === artist.id))) return { problem: 'not-yours' };
      // Seeds are counted from what's saved, so not before it's loaded.
      if (!loaded.current) return { problem: 'loading' };
      const t = Date.now();
      const mine = seedGifts(storedRef.current.gifts.filter((g) => g.account === social.user!.uid)).map((g) => g.at);
      if (seedsLeft(mine, t, festivalDay) <= 0) return { problem: 'no-seeds' };
      const id = randomId();
      const words = note ? cleanSproutNote(note) : '';
      const gift: Gift = { id, kind, ...(cleanArtist ? { artist: cleanArtist } : {}), ...(theme && isGiftTheme(theme) && canGiveThemes(social.profile.handle) ? { theme } : {}), at: t, sent: false, tries: 0, account: social.user.uid, ...(words ? { note: words } : {}), ...(tonight ? { festivalId: tonight.festival.id } : {}) };
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

  // ---- Gift themes ------------------------------------------------------
  const handle = social.profile?.handle;
  const giftThemes = useMemo(
    () =>
      giftThemesOf(sprouts, handle).map((g) => {
        const s = sprouts.find((x) => x.id === g.sprout);
        return { ...g, granted: !g.sprout || !!s?.themeGranted, shown: !g.sprout || !!s?.themeShown, ...(s?.wearOnArrival ? { wearOnArrival: true } : {}) };
      }),
    [sprouts, handle],
  );
  const giftThemeShown = useCallback(
    (sproutId: string) => setStored((s) => ({ ...s, garden: s.garden.map((g) => (g.id === sproutId && g.theme && !g.themeShown ? { ...g, themeShown: true } : g)) })),
    [setStored],
  );
  // Sprouts that arrived in the background, to show once (with the offer to follow whoever gave them).
  const toAskFollow = useMemo(() => (account ? stored.garden.filter((g) => g.account === account && g.late && g.from && g.handle && !g.followAsked) : []), [stored.garden, account]);
  const followAsked = useCallback(
    (sproutId: string) =>
      setStored((s) => (s.garden.some((g) => g.id === sproutId && g.account === accountRef.current && !g.followAsked) ? { ...s, garden: s.garden.map((g) => (g.id === sproutId && g.account === accountRef.current ? { ...g, followAsked: true } : g)) } : s)),
    [setStored],
  );
  const gardenShown = !stored.gardenHidden;
  const setGardenShown = useCallback(
    (on: boolean) =>
      setStored((s) => {
        if (on === !s.gardenHidden) return s;
        const { gardenHidden: _was, ...rest } = s;
        return on ? rest : { ...rest, gardenHidden: true };
      }),
    [setStored],
  );
  // Each gift theme's grant saved on Afterglow, so your profile can show its background (tried again on the next round).
  const granting = useRef(new Set<string>());
  useEffect(() => {
    if (!account || !online || !social.availability.ok) return;
    for (const g of stored.garden) {
      if (g.account !== account || !g.theme || g.themeGranted || granting.current.has(g.id)) continue;
      const { id, theme } = g;
      granting.current.add(id);
      void timeout(social.service.grantTheme(id, theme), TRY_TIMEOUT_MS)
        .then(() => setStored((s) => ({ ...s, garden: s.garden.map((x) => (x.id === id && x.account === account ? { ...x, themeGranted: true } : x)) })))
        .catch(() => {})
        .finally(() => granting.current.delete(id));
    }
  }, [account, online, social.availability.ok, social.service, stored.garden, back, setStored]);

  const value = useMemo<Ctx>(
    () => ({ hydrated, online, ready, festivalDay, seeds, garden, givable, collected, gifts, blooms, newBlooms, bloomShown, artists, newArtists, artistShown, claims, giftThemes, giftThemeShown, toAskFollow, followAsked, gardenShown, setGardenShown, give, takeBack, claim, checkGift, refresh }),
    [hydrated, online, ready, festivalDay, seeds, garden, givable, collected, gifts, blooms, newBlooms, bloomShown, artists, newArtists, artistShown, claims, giftThemes, giftThemeShown, toAskFollow, followAsked, gardenShown, setGardenShown, give, takeBack, claim, checkGift, refresh],
  );
  return <SproutsContext.Provider value={value}>{children}</SproutsContext.Provider>;
}

export function useSprouts(): Ctx {
  const ctx = useContext(SproutsContext);
  if (!ctx) throw new Error('useSprouts must be used inside SproutsProvider');
  return ctx;
}
