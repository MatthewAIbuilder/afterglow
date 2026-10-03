import type { Notice } from '../notifications/inbox';
import { type GardenSprout, isKind, kindOf, isSproutId, type SproutCard, type SproutKind, SPROUT_KEEP_DAYS, SPROUT_NOTE_MAX } from './sprouts';

/**
 * Giving and picking up sprouts with bad signal, pure. A sprout you give is
 * kept on the phone the moment its code shows and sent to Afterglow once
 * there's signal; one you scan is kept too and picked up once there is. The
 * giver may still be waiting for signal themselves, so a sprout that isn't
 * there yet is tried again for `CLAIM_KEEP_MS`.
 */
export type Gift = {
  id: string;
  kind: SproutKind;
  note?: string;
  festivalId?: string;
  /** When you gave it (phone time). */
  at: number;
  /** It's reached Afterglow. */
  sent: boolean;
  /** The account that gave it. */
  account?: string;
  /** Someone picked it up. */
  claimedBy?: { uid: string; handle?: string; name?: string };
  claimedAt?: number;
  /** Taken back, but it may already be on Afterglow: removed there once there's signal. */
  takenBack?: boolean;
  tries: number;
  lastTry?: number;
};

export type ClaimState = 'waiting' | 'claimed' | 'taken' | 'gone';
export type Claim = {
  card: SproutCard;
  /** The account it's for (none yet: picked up once you sign in). */
  account?: string;
  at: number;
  state: ClaimState;
  tries: number;
  lastTry?: number;
  doneAt?: number;
};

/** Tries wait 15 s, doubling to 5 min. */
export const retryDelay = (tries: number) => Math.min(5 * 60_000, 15_000 * 2 ** Math.max(0, tries - 1));
/** A scan whose sprout never turns up is let go after this long. */
export const CLAIM_KEEP_MS = 3 * 24 * 3_600_000;
const GIFT_KEEP_MS = SPROUT_KEEP_DAYS * 24 * 3_600_000;
export const GIFTS_MAX = 300;

const due = (x: { tries: number; lastTry?: number }, now: number) => !x.lastTry || now - x.lastTry >= retryDelay(x.tries);

/** Gifts still to send, oldest first. */
export const giftsToSend = (gifts: readonly Gift[], now: number) => gifts.filter((g) => !g.sent && !g.takenBack && due(g, now)).sort((a, b) => a.at - b.at);
/** Gifts taken back that still need removing from Afterglow. */
export const giftsToTakeBack = (gifts: readonly Gift[], now: number) => gifts.filter((g) => g.takenBack && due(g, now));
/** Scans still to pick up for an account, oldest first. */
export const claimsToSend = (claims: readonly Claim[], account: string, now: number) =>
  claims.filter((c) => c.state === 'waiting' && (!c.account || c.account === account) && due(c, now)).sort((a, b) => a.at - b.at);

/** When the next waiting thing is due (ms), if any. */
export function nextDue(gifts: readonly Gift[], claims: readonly Claim[]): number | undefined {
  const times = [...gifts.filter((g) => !g.sent || g.takenBack), ...claims.filter((c) => c.state === 'waiting')].map((x) => (x.lastTry ?? 0) + retryDelay(x.tries));
  return times.length ? Math.min(...times) : undefined;
}

/** Keep a scan (once per sprout; scanning again changes nothing). */
export function queueClaim(claims: readonly Claim[], card: SproutCard, account: string | undefined, now: number): Claim[] {
  if (claims.some((c) => c.card.id === card.id)) return [...claims];
  return [{ card, account, at: now, state: 'waiting', tries: 0 }, ...claims];
}

/** Tidy: scans that never turned up become `gone`; old finished ones and old unsent gifts are forgotten. */
export function tidy(gifts: readonly Gift[], claims: readonly Claim[], now: number): { gifts: Gift[]; claims: Claim[] } {
  return {
    gifts: gifts.filter((g) => now - g.at < GIFT_KEEP_MS || g.claimedBy).slice(0, GIFTS_MAX),
    claims: claims
      .map((c) => (c.state === 'waiting' && now - c.at > CLAIM_KEEP_MS ? { ...c, state: 'gone' as const, doneAt: now } : c))
      .filter((c) => c.state === 'waiting' || !c.doneAt || now - c.doneAt < 7 * 24 * 3_600_000),
  };
}

export function cleanGifts(raw: unknown): Gift[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((g): g is Gift => !!g && typeof g === 'object' && isSproutId(g.id) && isKind(g.kind) && typeof g.at === 'number')
    .map((g) => ({
      id: g.id,
      kind: g.kind,
      at: g.at,
      sent: g.sent === true,
      tries: typeof g.tries === 'number' ? g.tries : 0,
      ...(typeof g.lastTry === 'number' ? { lastTry: g.lastTry } : {}),
      ...(typeof g.note === 'string' && g.note ? { note: g.note.slice(0, SPROUT_NOTE_MAX) } : {}),
      ...(typeof g.festivalId === 'string' ? { festivalId: g.festivalId } : {}),
      ...(typeof g.account === 'string' ? { account: g.account } : {}),
      ...(g.claimedBy && typeof g.claimedBy.uid === 'string' ? { claimedBy: g.claimedBy } : {}),
      ...(typeof g.claimedAt === 'number' ? { claimedAt: g.claimedAt } : {}),
      ...(g.takenBack === true ? { takenBack: true } : {}),
    }))
    .slice(0, GIFTS_MAX);
}

const STATES: readonly ClaimState[] = ['waiting', 'claimed', 'taken', 'gone'];
export function cleanClaims(raw: unknown): Claim[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is Claim =>
      !!c && typeof c === 'object' && !!c.card && isSproutId(c.card.id) && isKind(c.card.kind) && typeof c.card.from === 'string' && typeof c.at === 'number' && STATES.includes(c.state),
  );
}

/** What a scan says once it's done, or while it waits. */
export function claimLine(c: Claim): string {
  if (c.state === 'claimed') return 'In your garden';
  if (c.state === 'taken') return 'Someone else already picked this one up.';
  if (c.state === 'gone') return 'This sprout can’t be picked up. Ask them for a new code.';
  return c.account ? 'Saved on your phone. It joins your garden by itself once you’ve both had signal.' : 'Saved on this phone. Sign in to keep it.';
}

/** Sprouts you gave that were picked up lately become bell news for this many days. */
export const SPROUT_NEWS_DAYS = 14;

/** "Sam picked up your PLUR sprout", newest first, for the bell. */
export function sproutNotices(gifts: readonly Gift[], now: number): Notice[] {
  return gifts
    .filter((g) => g.claimedBy && g.claimedAt && now - g.claimedAt < SPROUT_NEWS_DAYS * 86_400_000)
    .sort((a, b) => (b.claimedAt ?? 0) - (a.claimedAt ?? 0))
    .slice(0, 10)
    .map((g) => ({
      id: `sprout:${g.id}`,
      kind: 'sprout' as const,
      title: `${g.claimedBy!.name ?? (g.claimedBy!.handle ? `@${g.claimedBy!.handle}` : 'Someone')} picked up your ${kindOf(g.kind).name}`,
      body: g.note ? `With your note: “${g.note}”. It’s growing in their garden now.` : 'It’s growing in their garden now.',
      href: '/garden',
    }));
}

/** "Your sprout bloomed into a Wanderer sprout", for the bell, for `SPROUT_NEWS_DAYS`. */
export function bloomNotices(blooms: readonly { id: string; kind: SproutKind; at: number }[], now: number): Notice[] {
  return blooms
    .filter((b) => b.kind !== 'seedling' && now - b.at < SPROUT_NEWS_DAYS * 86_400_000)
    .sort((a, b) => b.at - a.at)
    .map((b) => {
      const name = kindOf(b.kind).name;
      return { id: `bloom:${b.id}`, kind: 'sprout' as const, title: `Your sprout bloomed into a ${name}`, body: `You can give ${name}s now.`, href: '/garden' };
    });
}

/** "Your sprout from Maya is in your garden": for sprouts picked up in the background. */
export function arrivalNotices(garden: readonly GardenSprout[], now: number): Notice[] {
  return garden
    .filter((g) => g.late && now - g.at < SPROUT_NEWS_DAYS * 86_400_000)
    .sort((a, b) => b.at - a.at)
    .slice(0, 10)
    .map((g) => ({
      id: `sprout-in:${g.id}`,
      kind: 'sprout' as const,
      title: `Your ${kindOf(g.kind).name} from ${g.name ?? (g.handle ? `@${g.handle}` : 'a friend')} is in your garden`,
      body: g.note ? `“${g.note}”` : 'It grows as you go: festival days, sets, videos and sprouts you give.',
      href: '/garden',
    }));
}

/** "A wild Bass sprout at Cyclops Cove 4": a wild sprout appeared in your garden. */
export function wildNotices(garden: readonly GardenSprout[], now: number): Notice[] {
  return garden
    .filter((g) => g.foundAt && now - g.at < SPROUT_NEWS_DAYS * 86_400_000)
    .sort((a, b) => b.at - a.at)
    .slice(0, 10)
    .map((g) => ({
      id: `sprout-wild:${g.id}`,
      kind: 'sprout' as const,
      title: `A wild ${kindOf(g.kind).name} appeared at ${g.foundAt}`,
      body: 'It’s in your garden. Every festival night brings a new one.',
      href: '/garden',
    }));
}
