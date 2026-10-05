import type { Crew, CrewMessage, CrewPicks, CrewUpdate, MeetSpot, Profile } from '../social/models';

/**
 * What this phone last read about people, kept per account so a festival
 * with no signal still shows your profile, your crews, who's in them, their
 * stars, latest check-ins, meeting spots and chats. Pure: the store is
 * `state/lastKnown.ts`.
 *
 * Only what the server already sent you (nothing new is gathered), kept on
 * this phone, never logged, forgotten when the account is deleted here.
 */
export type Kept<T> = { value: T; at: number };

export type AccountKept = {
  profile?: Kept<Profile>;
  blocked?: string[];
  following?: string[];
  crews?: Kept<Crew[]>;
  /** Crew id -> everyone's shared stars. */
  picks?: Record<string, CrewPicks[]>;
  /** Crewmates' profiles (names and faces), by uid. */
  people?: Record<string, Profile>;
  /** Crew id -> updates, newest first, and when they were read. */
  updates?: Record<string, Kept<CrewUpdate[]>>;
  /** Crew id -> meeting spot (null: none set). */
  meets?: Record<string, MeetSpot | null>;
  /** Chat room id -> the newest messages, as last read, and when. */
  chat?: Record<string, Kept<CrewMessage[]>>;
};

export type LastKnownBook = Record<string, AccountKept>;

/** Anything not read again for this long is let go. */
export const LAST_KNOWN_KEEP_MS = 30 * 24 * 3600 * 1000;
/** At most this many messages are kept per chat. */
export const KEPT_MESSAGES_MAX = 150;
/** At most this many updates are kept per crew. */
export const KEPT_UPDATES_MAX = 100;
/** At most this many accounts are kept (one phone, a few accounts). */
export const KEPT_ACCOUNTS_MAX = 5;

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x: unknown): x is string => typeof x === 'string' && !!x;
const strs = (x: unknown): string[] | undefined => (Array.isArray(x) ? x.filter(str) : undefined);
const fresh = (at: unknown, now: number): at is number => typeof at === 'number' && Number.isFinite(at) && at <= now + 60_000 && now - at < LAST_KNOWN_KEEP_MS;

const isProfile = (p: unknown): p is Profile => isObj(p) && str(p.uid) && typeof p.handle === 'string' && typeof p.displayName === 'string';
const isCrew = (c: unknown): c is Crew => isObj(c) && str(c.id) && str(c.festivalId) && typeof c.name === 'string' && str(c.owner) && Array.isArray(c.members) && c.members.every(str);
const isPicks = (p: unknown): p is CrewPicks => isObj(p) && str(p.uid) && Array.isArray(p.artists) && p.artists.every(str);
const isUpdate = (u: unknown): u is CrewUpdate => isObj(u) && str(u.id) && str(u.crewId) && str(u.uid) && str(u.kind) && str(u.at) && str(u.festivalId);
const isMessage = (m: unknown): m is CrewMessage => isObj(m) && str(m.id) && str(m.crewId) && str(m.uid) && typeof m.text === 'string' && str(m.at);
const isMeet = (m: unknown): m is MeetSpot => isObj(m) && str(m.text) && typeof m.by === 'string' && typeof m.at === 'string';

function cleanKept<T>(raw: unknown, now: number, ok: (v: unknown) => v is T, max?: number): Kept<T[]> | undefined {
  if (!isObj(raw) || !fresh(raw.at, now) || !Array.isArray(raw.value)) return undefined;
  const value = raw.value.filter(ok);
  return { value: max ? value.slice(0, max) : value, at: raw.at };
}

function cleanRecord<T>(raw: unknown, clean: (v: unknown) => T | undefined): Record<string, T> | undefined {
  if (!isObj(raw)) return undefined;
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(raw)) {
    const c = clean(v);
    if (c !== undefined) out[k] = c;
  }
  return out;
}

function cleanAccount(raw: unknown, now: number): AccountKept | undefined {
  if (!isObj(raw)) return undefined;
  const out: AccountKept = {};
  if (isObj(raw.profile) && fresh(raw.profile.at, now) && isProfile(raw.profile.value)) out.profile = { value: raw.profile.value, at: raw.profile.at };
  const blocked = strs(raw.blocked);
  if (blocked) out.blocked = blocked;
  const following = strs(raw.following);
  if (following) out.following = following;
  const crews = cleanKept(raw.crews, now, isCrew);
  if (crews) out.crews = crews;
  const picks = cleanRecord(raw.picks, (v) => (Array.isArray(v) ? v.filter(isPicks) : undefined));
  if (picks) out.picks = picks;
  const people = cleanRecord(raw.people, (v) => (isProfile(v) ? v : undefined));
  if (people) out.people = people;
  const updates = cleanRecord(raw.updates, (v) => cleanKept(v, now, isUpdate, KEPT_UPDATES_MAX));
  if (updates) out.updates = updates;
  const meets = cleanRecord(raw.meets, (v) => (v === null ? null : isMeet(v) ? v : undefined));
  if (meets) out.meets = meets;
  const chat = cleanRecord(raw.chat, (v) => cleanKept(v, now, isMessage, KEPT_MESSAGES_MAX));
  if (chat) out.chat = chat;
  return out;
}

/** What was saved, made safe to use (anything malformed or too old is dropped). */
export function cleanLastKnown(raw: unknown, now: number): LastKnownBook {
  const out: LastKnownBook = {};
  if (!isObj(raw)) return out;
  for (const [uid, acct] of Object.entries(raw)) {
    const c = str(uid) ? cleanAccount(acct, now) : undefined;
    if (c) out[uid] = c;
  }
  return out;
}

/** The newest time anything was read for an account (for keeping the most recent accounts). */
const newest = (a: AccountKept) =>
  Math.max(a.profile?.at ?? 0, a.crews?.at ?? 0, ...Object.values(a.updates ?? {}).map((k) => k.at), ...Object.values(a.chat ?? {}).map((k) => k.at));

/**
 * Keep something new for an account. Top-level parts replace what was there;
 * the per-crew and per-person parts (picks, people, updates, meets, chat) are
 * merged in, so reading one crew never forgets another.
 */
export function keep(book: LastKnownBook, uid: string, patch: AccountKept): LastKnownBook {
  const cur = book[uid] ?? {};
  const next: AccountKept = { ...cur, ...patch };
  for (const k of ['picks', 'people', 'updates', 'meets', 'chat'] as const)
    if (patch[k]) (next as Record<string, unknown>)[k] = { ...(cur[k] ?? {}), ...patch[k] };
  const all = { ...book, [uid]: next };
  const uids = Object.keys(all);
  if (uids.length <= KEPT_ACCOUNTS_MAX) return all;
  // Too many accounts on this phone: the one read longest ago goes (never this one).
  const oldest = uids.filter((u) => u !== uid).sort((a, b) => newest(all[a]) - newest(all[b]))[0];
  const { [oldest]: _gone, ...rest } = all;
  return rest;
}

/** Everything kept for an account goes (deleting it, on this phone). */
export function forgetAccount(book: LastKnownBook, uid: string): LastKnownBook {
  if (!(uid in book)) return book;
  const { [uid]: _gone, ...rest } = book;
  return rest;
}

/** When a bunch of kept reads were made: the oldest of them (so the line never says it's fresher than it is). */
export function keptAt(kept: readonly (Kept<unknown> | undefined)[]): number | undefined {
  const ats = kept.flatMap((k) => (k ? [k.at] : []));
  return ats.length ? Math.min(...ats) : undefined;
}

const clockOf = (ms: number) => {
  const d = new Date(ms);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/** "9:41 PM" today, "Dec 4, 9:41 PM" another day. */
export function whenRead(at: number, now: number): string {
  if (sameDay(at, now)) return clockOf(at);
  const d = new Date(at);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${clockOf(at)}`;
}

/**
 * The quiet line under something read from the server:
 * - no signal, with something kept: "No signal, showing what you had · Last updated 9:41 PM"
 * - no signal, nothing kept: "No signal. This fills in once you’re back online."
 * - signal, but the last read didn't get through: "Last updated 9:41 PM"
 * - up to date: nothing.
 */
export function lastUpdatedLine({ at, offline, live, now }: { at?: number; offline: boolean; live: boolean; now: number }): string | undefined {
  if (offline) return at ? `No signal, showing what you had · Last updated ${whenRead(at, now)}` : 'No signal. This fills in once you’re back online.';
  if (!live && at) return `Last updated ${whenRead(at, now)}`;
  return undefined;
}
