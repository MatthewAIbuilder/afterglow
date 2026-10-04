import { WEB_URL } from '../../config/app';
import { type ArtistLook, stickerLook } from '../sprouts/artistLook';

/**
 * Stickers: collectibles you find in the wild by scanning a code, pure.
 *
 * - Afterglow HQ makes a sticker (a name, a creature, maybe an end date and
 *   a hunt) and prints its code. Every copy of a sticker has the same code,
 *   so a photo of one works too: that's fine, it brings people in.
 * - The code is a link (`https://afterglowmusic.app/find/<code>?c=…&n=…`) that
 *   carries the creature and name, so a find shows straight away with no
 *   signal; Afterglow's own copy wins once it's read. A phone's camera opens
 *   it on the website for someone without the app.
 * - A hunt groups stickers ("Find all 6"); your finds fill it in.
 * - Finds are kept on the phone (per account) and sent to Afterglow when
 *   there's signal, keeping when you scanned. One found before its end date
 *   counts even if it's sent a little after (`FIND_GRACE_DAYS`, as the rules).
 */

export type Sticker = {
  code: string;
  name: string;
  creature: string;
  /** The hunt it belongs to and its place in it. */
  huntId?: string;
  slot?: number;
  /** It can be found until then (ms). */
  until?: number;
  festivalId?: string;
  createdAt?: number;
};

export type Hunt = {
  id: string;
  name: string;
  until?: number;
  festivalId?: string;
  /** Its stickers in order (no codes: those are on the stickers). */
  items: { creature: string; name: string }[];
};

/** What HQ fills in to make a sticker (the code is made on the phone). */
export type StickerInput = { code: string; name: string; creature: string; huntId?: string; until?: number; festivalId?: string };
export type HuntInput = { id: string; name: string; until?: number; festivalId?: string };

export type FindState = 'checking' | 'found' | 'ended' | 'gone';
export type Find = {
  code: string;
  name: string;
  creature: string;
  huntId?: string;
  slot?: number;
  /** When you scanned it (phone time). */
  at: number;
  /** The account it's for (none: signed out; the next account to sign in keeps it). */
  account?: string;
  state: FindState;
  /** Afterglow knows you found it. */
  sent: boolean;
  /** When it could be found until, if it ended. */
  until?: number;
  tries: number;
  lastTry?: number;
};

export const STICKER_NAME_MAX = 40;
export const HUNT_NAME_MAX = 40;
export const HUNT_MAX_ITEMS = 24;
/** A find made before the end date is accepted this long after it (the rules say the same). */
export const FIND_GRACE_DAYS = 3;
export const FINDS_MAX = 500;

/** Codes: `CODE_LENGTH` characters nobody mixes up when reading them. */
export const CODE_LENGTH = 10;
const CODE_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';
const CODE = /^[a-z0-9]{6,24}$/;
const HUNT_ID = /^[a-z0-9]{6,24}$/;
export const isStickerCode = (c: unknown): c is string => typeof c === 'string' && CODE.test(c);
export const isHuntId = (c: unknown): c is string => typeof c === 'string' && HUNT_ID.test(c);
export function codeFrom(bytes: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_CHARS[(bytes[i] ?? 0) % CODE_CHARS.length];
  return out;
}

export const cleanName = (raw: unknown, max = STICKER_NAME_MAX) => (typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** A sticker's look, or the wisp when its creature isn't one this version knows. */
export const lookOf = (creature: string): ArtistLook => stickerLook(creature) ?? stickerLook('wisp')!;

/** What a code says: enough to show it with no signal. */
export type FindCard = { code: string; creature: string; name: string };

export function findLink(card: FindCard, base = WEB_URL): string {
  return `${base.replace(/\/+$/, '')}/find/${card.code}?c=${encodeURIComponent(card.creature)}&n=${encodeURIComponent(cleanName(card.name))}`;
}

/** A card from a link's parts or `/find/[code]`'s params. An unknown creature or a missing name still reads (Afterglow's copy fills them in). */
export function findCardFrom(parts: { code?: unknown; c?: unknown; n?: unknown }): FindCard | undefined {
  if (!isStickerCode(parts.code)) return undefined;
  const creature = typeof parts.c === 'string' && stickerLook(parts.c) ? parts.c : 'wisp';
  return { code: parts.code, creature, name: cleanName(parts.n) || 'A sticker' };
}

/** A scanned code, if it's an Afterglow sticker (from any Afterglow address, or `afterglow://find/…`). */
export function readFindLink(text: string): FindCard | undefined {
  const m = /^(?:https:\/\/(?:www\.)?(?:afterglowmusic\.app|afterglowmusic\.web\.app)|afterglow:\/)\/find\/([a-z0-9]+)(?:\?([^#]*))?$/i.exec(text.trim());
  if (!m) return undefined;
  const params: Record<string, string> = {};
  for (const pair of (m[2] ?? '').split('&')) {
    const i = pair.indexOf('=');
    if (i <= 0) continue;
    try {
      params[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
    } catch {
      return undefined;
    }
  }
  return findCardFrom({ code: m[1].toLowerCase(), c: params.c, n: params.n });
}

/** Whether it can still be found at `at` (no end date: always). */
export const stillOpen = (s: Pick<Sticker, 'until'>, at: number) => s.until === undefined || at <= s.until;

/**
 * Keep a scan, once per sticker and account. Scanning again changes nothing.
 * Signed in, a signed-out scan of it counts too (it becomes yours); signed
 * out, only another signed-out scan does (someone else's find on this phone
 * isn't yours).
 */
export function queueFind(finds: readonly Find[], card: FindCard, account: string | undefined, now: number): Find[] {
  if (finds.some((f) => f.code === card.code && (!f.account || f.account === account))) return [...finds];
  return [{ code: card.code, name: card.name, creature: card.creature, at: now, ...(account ? { account } : {}), state: 'checking' as const, sent: false, tries: 0 }, ...finds].slice(0, FINDS_MAX);
}

/** A find once Afterglow's copy of its sticker is read (null: there's no such sticker). */
export function checked(f: Find, sticker: Sticker | null, now: number): Find {
  if (!sticker) return { ...f, state: 'gone', lastTry: now };
  const own = {
    ...f,
    name: sticker.name,
    creature: sticker.creature,
    ...(sticker.huntId ? { huntId: sticker.huntId, slot: sticker.slot } : {}),
    // Checked: send it straight away.
    lastTry: undefined,
    tries: 0,
  };
  return stillOpen(sticker, f.at) ? { ...own, state: 'found' } : { ...own, state: 'ended', until: sticker.until };
}

/** Tries wait 15 s, doubling to 5 min. */
export const retryDelay = (tries: number) => Math.min(5 * 60_000, 15_000 * 2 ** Math.max(0, tries - 1));
const due = (f: Find, now: number) => !f.lastTry || now - f.lastTry >= retryDelay(f.tries);

/** Scans still to check, oldest first. */
export const findsToCheck = (finds: readonly Find[], now: number) => finds.filter((f) => f.state === 'checking' && due(f, now)).sort((a, b) => a.at - b.at);
/** Finds Afterglow doesn't know about yet, for an account, oldest first. */
export const findsToSend = (finds: readonly Find[], account: string, now: number) =>
  finds.filter((f) => f.state === 'found' && !f.sent && f.account === account && due(f, now)).sort((a, b) => a.at - b.at);
/** When the next waiting one is due (ms), if any. */
export function nextFindDue(finds: readonly Find[], account?: string): number | undefined {
  const times = finds.filter((f) => f.state === 'checking' || (account && f.state === 'found' && !f.sent && f.account === account)).map((f) => (f.lastTry ?? 0) + retryDelay(f.tries));
  return times.length ? Math.min(...times) : undefined;
}

/** A try that didn't reach Afterglow (no signal): try again later. */
export const missed = (f: Find, now: number): Find => ({ ...f, tries: f.tries + 1, lastTry: now });

/** Finds made signed out go to the first account that signs in. */
export const adopt = (finds: readonly Find[], account: string): Find[] =>
  finds.some((f) => !f.account) ? finds.map((f) => (f.account ? f : { ...f, account })).filter((f, i, all) => all.findIndex((g) => g.code === f.code && g.account === f.account) === i) : [...finds];

/** The finds an account sees (its own and any made signed out), newest first. */
export const findsFor = (finds: readonly Find[], account?: string) => finds.filter((f) => !f.account || f.account === account).sort((a, b) => b.at - a.at);
/** Only the ones that count. */
export const foundOnly = (finds: readonly Find[]) => finds.filter((f) => f.state === 'found');

export type HuntProgress = { hunt: Hunt; found: boolean[]; count: number; done: boolean };
/** How far you are with each hunt you've found something from, finished ones last. */
export function huntProgress(finds: readonly Find[], hunts: Record<string, Hunt>): HuntProgress[] {
  const out: HuntProgress[] = [];
  for (const hunt of Object.values(hunts)) {
    const mine = foundOnly(finds).filter((f) => f.huntId === hunt.id);
    if (!mine.length) continue;
    const found = hunt.items.map((_, i) => mine.some((f) => f.slot === i));
    const count = found.filter(Boolean).length;
    out.push({ hunt, found, count, done: count === hunt.items.length && count > 0 });
  }
  return out.sort((a, b) => Number(a.done) - Number(b.done) || b.count - a.count);
}

/** "3 of 6 found", "All 6 found". */
export const huntLine = (p: Pick<HuntProgress, 'count' | 'done'> & { hunt: Pick<Hunt, 'items'> }) =>
  p.done ? `All ${p.hunt.items.length} found` : `${p.count} of ${p.hunt.items.length} found`;

const day = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
/** "Can be found until Oct 12, 2026", or nothing without an end date. */
export const untilLine = (until?: number) => (until === undefined ? '' : `Can be found until ${day(until)}`);

/** What a find says while it waits or once it's done. */
export function findLine(f: Find): string {
  if (f.state === 'gone') return 'This code isn’t an Afterglow sticker any more.';
  if (f.state === 'ended') return f.until ? `This one could only be found until ${day(f.until)}.` : 'This one can’t be found any more.';
  if (f.state === 'checking') return 'Saved on your phone. It’s checked as soon as there’s signal.';
  return `Found ${day(f.at)}`;
}

const STATES: readonly FindState[] = ['checking', 'found', 'ended', 'gone'];
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
/** Read back saved finds, dropping anything malformed. */
export function cleanFinds(raw: unknown): Find[] {
  if (!Array.isArray(raw)) return [];
  const out: Find[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const at = num(o.at);
    if (!isStickerCode(o.code) || at === undefined || !STATES.includes(o.state as FindState)) continue;
    out.push({
      code: o.code,
      name: cleanName(o.name) || 'A sticker',
      creature: typeof o.creature === 'string' && stickerLook(o.creature) ? o.creature : 'wisp',
      ...(isHuntId(o.huntId) && num(o.slot) !== undefined ? { huntId: o.huntId, slot: num(o.slot) } : {}),
      at,
      ...(typeof o.account === 'string' && o.account ? { account: o.account } : {}),
      state: o.state as FindState,
      sent: o.sent === true,
      ...(num(o.until) !== undefined ? { until: num(o.until) } : {}),
      tries: num(o.tries) ?? 0,
      ...(num(o.lastTry) !== undefined ? { lastTry: num(o.lastTry) } : {}),
    });
  }
  return out.slice(0, FINDS_MAX);
}

/** Read back saved hunts. */
export function cleanHunts(raw: unknown): Record<string, Hunt> {
  const out: Record<string, Hunt> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const h = cleanHunt(id, v);
    if (h) out[id] = h;
  }
  return out;
}

/** A hunt from saved or downloaded data, or undefined if it isn't one. */
export function cleanHunt(id: string, raw: unknown): Hunt | undefined {
  if (!isHuntId(id) || !raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const name = cleanName(o.name, HUNT_NAME_MAX);
  if (!name || !Array.isArray(o.items)) return undefined;
  const items = o.items
    .filter((i): i is { creature: string; name: string } => !!i && typeof i === 'object' && typeof (i as { creature?: unknown }).creature === 'string')
    .map((i) => ({ creature: stickerLook(i.creature) ? i.creature : 'wisp', name: cleanName(i.name) || 'A sticker' }))
    .slice(0, HUNT_MAX_ITEMS);
  return { id, name, items, ...(num(o.until) !== undefined ? { until: num(o.until) } : {}), ...(typeof o.festivalId === 'string' ? { festivalId: o.festivalId } : {}) };
}

/** An end date typed in HQ ("2027-06-14"): the end of that day, phone time. Empty is no end date; anything else is `bad`. */
export function parseEndDate(text: string): number | undefined | 'bad' {
  const t = text.trim();
  if (!t) return undefined;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (!m) return 'bad';
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const end = new Date(y, mo - 1, d, 23, 59, 59, 999);
  return end.getFullYear() === y && end.getMonth() === mo - 1 && end.getDate() === d ? end.getTime() : 'bad';
}
