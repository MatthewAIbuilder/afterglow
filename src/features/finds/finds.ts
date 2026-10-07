import { WEB_URL } from '../../config/app';
import { LOCALE, t } from '../../i18n';
import { type ArtistLook, shinyFor, shinyLook, stickerLook } from '../sprouts/artistLook';

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
  /** HQ took it down then (ms): scans from before still count. */
  takenDownAt?: number;
  /** Made by an event organizer (features/organizers), for their events. */
  orgId?: string;
  /** A gift: sent as a link rather than printed, with a few words from whoever sent it. */
  gift?: true;
  note?: string;
};

export type Hunt = {
  id: string;
  name: string;
  until?: number;
  festivalId?: string;
  orgId?: string;
  /** Its stickers in order (no codes: those are on the stickers). `gone`: taken down, so it no longer counts unless you found it. */
  items: { creature: string; name: string; gone?: true }[];
};

/** What HQ fills in to make a sticker (the code is made on the phone). */
export type StickerInput = { code: string; name: string; creature: string; huntId?: string; until?: number; festivalId?: string; orgId?: string; gift?: true; note?: string };
export type HuntInput = { id: string; name: string; until?: number; festivalId?: string; orgId?: string };
/** A gift's few words. */
export const GIFT_NOTE_MAX = 200;

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

/**
 * Whether a sticker you found came out holographic: about one in twelve,
 * decided by your account and the sticker's code, so it's the same on every
 * phone and nobody can pick it. Never for a find not yet tied to an account.
 */
export const isHolo = (f: Pick<Find, 'code' | 'account' | 'state'>) => f.state === 'found' && !!f.account && shinyFor(f.account, `sticker:${f.code}`);

/** A found sticker's look: in its holo colours when it's a holo one. */
export const findLook = (f: Pick<Find, 'code' | 'account' | 'state' | 'creature'>): ArtistLook => (isHolo(f) ? shinyLook(lookOf(f.creature)) : lookOf(f.creature));

/** What a code says: enough to show it with no signal. */
export type FindCard = { code: string; creature: string; name: string };

export function findLink(card: FindCard, base = WEB_URL, via?: 'totem'): string {
  return `${base.replace(/\/+$/, '')}/find/${card.code}?c=${encodeURIComponent(card.creature)}&n=${encodeURIComponent(cleanName(card.name))}${via ? `&via=${via}` : ''}`;
}

/** A card from a link's parts or `/find/[code]`'s params. An unknown creature or a missing name still reads (Afterglow's copy fills them in). */
export function findCardFrom(parts: { code?: unknown; c?: unknown; n?: unknown }): FindCard | undefined {
  if (!isStickerCode(parts.code)) return undefined;
  const creature = typeof parts.c === 'string' && stickerLook(parts.c) ? parts.c : 'wisp';
  return { code: parts.code, creature, name: cleanName(parts.n) || 'A sticker' };
}

/** Where a place sticker you haven't found yet tends to be (for Your collection), if it's a place. */
export function placeHint(creature: string): string | undefined {
  const hints: Record<string, string> = {
    portapotty: t('Look in the porta potties.'),
    refill: t('Look by the water.'),
    charger: t('Look where people charge their phones.'),
    caretent: t('Look by the care tent.'),
    foodtruck: t('Look by the food trucks.'),
    lostfound: t('Ask at lost and found.'),
    pickup: t('Look at the pick-up point.'),
    silentdisco: t('Look at the silent disco.'),
    shuttle: t('Look at the shuttle stop.'),
    hammock: t('Look in the chill zone.'),
    gates: t('Look at the gates on your way in.'),
    merch: t('Look by the merch stand.'),
    shower: t('Look by the showers.'),
    mainstage: t('Look by the main stage.'),
    campfire: t('Look by the campfire.'),
  };
  return hints[creature];
}

/** A word from the place a sticker was found, shown when it's yours (some places only). */
export function placeLine(creature: string): string | undefined {
  switch (creature) {
    case 'portapotty':
      return t('You found the portal. Step through, then wash your hands.');
    case 'refill':
      return t('While you’re here: fill your bottle and have a drink.');
    case 'charger':
      return t('Top up your phone, and yourself: a snack, some water.');
    case 'hammock':
      return t('Take five. The music will still be there.');
    case 'shuttle':
      return t('Know which bus gets you home tonight.');
    case 'foodtruck':
      return t('Eat something proper. Your feet will thank you at 3am.');
    case 'caretent':
      return t('Friendly people are here all night if you or a friend need anything.');
    case 'lostfound':
      return t('Lost something, or found something? This is where it comes back.');
    case 'pickup':
      return t('Remember this spot: it’s where your ride home finds you.');
    case 'gates':
      return t('Welcome in. Drink water, find your people, have the best time.');
    case 'shower':
      return t('Fresh as day one. Don’t forget your towel.');
    case 'silentdisco':
      return t('Try another channel. Everyone’s dancing to something different.');
    default:
      return undefined;
  }
}

/** A sticker link scanned off a totem's screen (`findLink(…, 'totem')`). */
export const fromTotemLink = (text: string) => /[?&]via=totem(?:[&#]|$)/.test(text.trim());

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
  // Taken down: gone, unless you scanned it before then.
  if (!sticker || (sticker.takenDownAt !== undefined && f.at > sticker.takenDownAt)) return { ...f, state: 'gone', lastTry: now };
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

/** How good a find's state is, when two copies of one meet: found beats waiting, which beats ended or gone. */
const RANK: Record<FindState, number> = { found: 3, checking: 2, ended: 1, gone: 0 };
/**
 * One find from two copies of the same sticker for one account: the better
 * state (the account's own on a tie), sent if either got through, and the
 * earliest scan (it was found then).
 */
export function better(own: Find, other: Find): Find {
  const win = RANK[other.state] > RANK[own.state] ? other : own;
  const sent = win.state === 'found' && ((own.state === 'found' && own.sent) || (other.state === 'found' && other.sent));
  return { ...win, account: own.account ?? other.account, at: Math.min(own.at, other.at), sent: sent || win.sent };
}

/**
 * Finds made signed out go to the first account that signs in. A sticker the
 * account already has keeps the account's copy unless the other is better
 * (a later re-scan never replaces a confirmed find, nor marks it ended).
 */
export function adopt(finds: readonly Find[], account: string): Find[] {
  if (!finds.some((f) => !f.account)) return [...finds];
  const out: Find[] = [];
  // The account's own (and other accounts') first, so they win ties.
  for (const f of [...finds.filter((x) => x.account), ...finds.filter((x) => !x.account)]) {
    const mine = f.account ? f : { ...f, account };
    const i = out.findIndex((g) => g.code === mine.code && g.account === mine.account);
    if (i < 0) out.push(mine);
    else out[i] = better(out[i], mine);
  }
  return out;
}

/** What Afterglow says an account found (its own record of it). */
export type AccountFind = { code: string; at: number };

/**
 * Finds kept on the account (from another phone, or before a reinstall)
 * brought onto this phone as found and sent, with their stickers as read
 * (`stickerOf`; one that can't be read isn't added). Ones already here become
 * found and sent too, keeping the earliest scan. Unchanged: the same array.
 */
export function withAccountFinds(finds: readonly Find[], account: string, remote: readonly AccountFind[], stickerOf: (code: string) => Sticker | null | undefined): readonly Find[] {
  let out: Find[] | undefined;
  for (const r of remote) {
    const list = out ?? finds;
    const i = list.findIndex((f) => f.code === r.code && f.account === account);
    const have = i >= 0 ? list[i] : undefined;
    if (have && have.state === 'found' && have.sent && have.at <= r.at) continue;
    const s = stickerOf(r.code);
    let next: Find;
    if (have) next = { ...have, ...(s ? { name: s.name, creature: s.creature, ...(s.huntId ? { huntId: s.huntId, slot: s.slot } : {}) } : {}), state: 'found', sent: true, at: Math.min(have.at, r.at), tries: 0, lastTry: undefined, until: undefined };
    else if (s) next = { code: r.code, name: s.name, creature: s.creature, ...(s.huntId ? { huntId: s.huntId, slot: s.slot } : {}), at: r.at, account, state: 'found', sent: true, tries: 0 };
    else continue;
    out = [...list];
    if (i >= 0) out[i] = next;
    else out.unshift(next);
  }
  return out ? out.slice(0, FINDS_MAX) : finds;
}

/** The finds an account sees (its own and any made signed out), newest first. */
export const findsFor = (finds: readonly Find[], account?: string) => finds.filter((f) => !f.account || f.account === account).sort((a, b) => b.at - a.at);
/** Only the ones that count. */
export const foundOnly = (finds: readonly Find[]) => finds.filter((f) => f.state === 'found');

/** `last`: when you found your latest one (the day you finished, once it's done). */
export type HuntProgress = { hunt: Hunt; found: boolean[]; count: number; total: number; done: boolean; last: number };
/** Whether a hunt's sticker counts for you: still out there, or one you found before it was taken down. */
export const counts = (hunt: Hunt, found: readonly boolean[], i: number) => !hunt.items[i]?.gone || !!found[i];
/** How far you are with each hunt you've found something from, finished ones last. */
export function huntProgress(finds: readonly Find[], hunts: Record<string, Hunt>): HuntProgress[] {
  const out: HuntProgress[] = [];
  for (const hunt of Object.values(hunts)) {
    const mine = foundOnly(finds).filter((f) => f.huntId === hunt.id);
    if (!mine.length) continue;
    const found = hunt.items.map((_, i) => mine.some((f) => f.slot === i));
    const count = found.filter(Boolean).length;
    const total = hunt.items.filter((_, i) => counts(hunt, found, i)).length;
    out.push({ hunt, found, count, total, done: count === total && count > 0, last: Math.max(...mine.map((f) => f.at)) });
  }
  return out.sort((a, b) => Number(a.done) - Number(b.done) || b.count - a.count);
}

/** "3 of 6 found", "All 6 found". */
export const huntLine = (p: Pick<HuntProgress, 'count' | 'total' | 'done'>) => (p.done ? t('All {total} found', { total: p.total }) : t('{n} of {total} found', { n: p.count, total: p.total }));

/** What goes out when you share a hunt: how far you got, and where to find Afterglow. */
export function huntShareText(p: Pick<HuntProgress, 'count' | 'total' | 'done'> & { hunt: Pick<Hunt, 'name'> }, webUrl: string): string {
  return p.done
    ? t('I found all {total} stickers in the {hunt} hunt on Afterglow. {link}', { total: p.total, hunt: p.hunt.name, link: webUrl })
    : t('I’ve found {n} of {total} stickers in the {hunt} hunt on Afterglow. {link}', { n: p.count, total: p.total, hunt: p.hunt.name, link: webUrl });
}

const day = (at: number) => new Date(at).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
/**
 * The day an end date was set for, wherever you are: end dates last until
 * that day is over everywhere (see parseEndDate), so its day is the UTC date
 * 12 hours before. (Older ones, set at the end of the day on HQ's phone, read
 * the same for HQ anywhere from UTC−12 to just under UTC+12.)
 */
const endDay = (at: number) => new Date(at - 12 * 3_600_000).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
/** "Can be found until Oct 12, 2026", or nothing without an end date. */
export const untilLine = (until?: number) => (until === undefined ? '' : t('Can be found until {date}', { date: endDay(until) }));

/** What a find says while it waits or once it's done. */
export function findLine(f: Find): string {
  if (f.state === 'gone') return t('This code isn’t an Afterglow sticker any more.');
  if (f.state === 'ended') return f.until ? t('This one could only be found until {date}.', { date: endDay(f.until) }) : t('This one can’t be found any more.');
  if (f.state === 'checking') return t('Saved on your phone. It’s checked as soon as there’s signal.');
  return t('Found {date}', { date: day(f.at) });
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
    .filter((i): i is { creature: string; name: string; gone?: unknown } => !!i && typeof i === 'object' && typeof (i as { creature?: unknown }).creature === 'string')
    .map((i) => ({ creature: stickerLook(i.creature) ? i.creature : 'wisp', name: cleanName(i.name) || 'A sticker', ...(i.gone === true ? { gone: true as const } : {}) }))
    .slice(0, HUNT_MAX_ITEMS);
  return { id, name, items, ...(num(o.until) !== undefined ? { until: num(o.until) } : {}), ...(typeof o.festivalId === 'string' ? { festivalId: o.festivalId } : {}), ...(typeof o.orgId === 'string' ? { orgId: o.orgId } : {}) };
}

/**
 * An end date typed in HQ ("2027-06-14"): until that day is over everywhere
 * (its end in the last time zone, UTC−12), so a sticker never stops early
 * wherever the festival is, whatever time zone HQ's phone is in. Empty is no
 * end date; anything else is `bad`.
 */
export function parseEndDate(text: string): number | undefined | 'bad' {
  const t = text.trim();
  if (!t) return undefined;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (!m) return 'bad';
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const end = new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999));
  return end.getUTCFullYear() === y && end.getUTCMonth() === mo - 1 && end.getUTCDate() === d ? end.getTime() + 12 * 3_600_000 : 'bad';
}

/** "Finished Oct 10, 2026" for a finished hunt, else "Latest find Oct 9, 2026". */
export const huntDateLine = (p: Pick<HuntProgress, 'done' | 'last'>) => (p.done ? t('Finished {date}', { date: day(p.last) }) : t('Latest find {date}', { date: day(p.last) }));
