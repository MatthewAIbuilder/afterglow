import type { Artist, CatalogSnapshot, Festival, SetTime, Show, SoundTag } from '../../data/models';
import { SOUND_TAGS } from '../../data/models';
import type { OrgStarter } from '../../config/organizers';
import { matchesName, nameRank, normalize } from '../festivals/search';
import type { Notice } from '../notifications/inbox';
import { t } from '../../i18n';

/**
 * Event organizers, pure: an organizer's page (who they are, their events and
 * lineups, words about the artists they book), turned into festivals and
 * artists the rest of the app already knows how to show. Their events then
 * get everything a festival has: a page, plans, crowd videos and a badge.
 *
 * - An organizer edits only its own page (`orgs/{id}`; the rules check the
 *   signed-in email against `orgMembers/{email}`). HQ can edit any.
 * - An event shows to everyone only once it's published.
 * - Words about an artist apply only to artists on that organizer's own
 *   published events. A photo or SoundCloud link set in the catalogue wins;
 *   artists new to Afterglow take the organizer's.
 * - Promotion is given by HQ only (`promoted`), shown labelled as promoted,
 *   and never changes anyone's taste scores.
 */

export type OrgMark = 'alchemy';

/** One act on an event's lineup: the name as billed, matched to an artist on Afterglow when possible. */
export type OrgAct = {
  name: string;
  /** Their Afterglow id, when the organizer picked them from Afterglow's artists. */
  artistId?: string;
  /** Set time, "23:30" to "01:00" (after midnight still belongs to the night it starts). */
  start?: string;
  end?: string;
};

export type OrgEvent = {
  /** "transmutation-nov-14": letters, numbers and dashes. */
  id: string;
  name: string;
  /** The night it starts, "YYYY-MM-DD". */
  date: string;
  /** The last night, for an event over several nights. */
  endDate?: string;
  /** Doors, "22:00". */
  doors?: string;
  venue: string;
  /** "Orlando, FL". */
  city: string;
  about?: string;
  /** Tickets and a flyer or poster (https). */
  tickets?: string;
  poster?: string;
  /** The festival on Afterglow it's the after party of (its id). */
  afterOf?: string;
  lineup: OrgAct[];
  /** Shown to everyone. Drafts are only in the studio. */
  published: boolean;
  /**
   * Copied from an imported event (EDMTrain's festival or show with this id)
   * to edit on Afterglow. Once published it shows instead of the imported
   * one (a festival keeps its id, so plans, videos and badges stay); the
   * import itself is never changed, and comes back if this is unpublished.
   */
  from?: string;
  fromKind?: 'festival' | 'show';
};

/** What an organizer says about an artist they book. */
export type OrgArtist = {
  name: string;
  /** A photo they have the rights to (https). */
  photo?: string;
  /** "https://soundcloud.com/…". */
  soundcloud?: string;
  /** Instagram username, without the @. */
  instagram?: string;
  bio?: string;
  sounds?: SoundTag[];
};

export type Org = {
  id: string;
  name: string;
  tagline?: string;
  about?: string;
  website?: string;
  instagram?: string;
  /** A logo the app draws. */
  mark?: OrgMark;
  /** A logo it uploaded (https): the wide wordmark. Wins over the one shipped with the app and the drawn one. */
  logoUrl?: string;
  /** A square icon it uploaded (https), for round places (its profile face). */
  iconUrl?: string;
  /** The brand's colour ("#E9E6F2"). */
  color?: string;
  events: OrgEvent[];
  /** By artist id. */
  artists: Record<string, OrgArtist>;
  /**
   * Imported events (EDMTrain festivals and shows, by id) the organizer says
   * are theirs: they show "Hosted by" and the organizer's mark, and list on
   * its page, as imported.
   */
  claims: string[];
  /** Event id -> the last day it's promoted ("YYYY-MM-DD"). Only HQ sets it. */
  promoted: Record<string, string>;
  /**
   * The Afterglow accounts that run it (uids): their profile shows the
   * organizer, and they open its studio. HQ links an account from Accounts;
   * someone signed in with an organizer's email links their own when they open
   * the studio.
   */
  uids: string[];
  /**
   * The @handle (and, with `name`, the display name) its accounts' profiles
   * use, chosen in HQ: an account that runs it takes them when it opens the
   * studio. Only HQ sets it.
   */
  handle?: string;
  updatedAt?: string;
};

export type OrgRequestKind = 'promotion' | 'design' | 'gift' | 'other';
export type OrgRequestStatus = 'open' | 'approved' | 'declined' | 'done';
export type OrgRequest = {
  id: string;
  orgId: string;
  by: string;
  kind: OrgRequestKind;
  /** The event it's about (a promotion always has one). */
  eventId?: string;
  /** For a promotion: how many days. */
  days?: number;
  /** For a design: what it's for (a badge, a sticker…). */
  about?: string;
  text: string;
  status: OrgRequestStatus;
  reply?: string;
  createdAt: string;
  answeredAt?: string;
};
export type OrgRequestInput = Pick<OrgRequest, 'orgId' | 'kind' | 'text'> & Partial<Pick<OrgRequest, 'eventId' | 'days' | 'about'>>;

/**
 * One day of an organizer's numbers ("YYYY-MM-DD", UTC): page views, event
 * page views (`e_<id>`), ticket taps, promoted views and first finds of its
 * stickers and gifts (`f_<code>`). Counts only, never who.
 */
export type OrgDay = { day: string; counts: Record<string, number> };
export type OrgCounter = 'page' | 'promo' | 'tickets' | `e_${string}` | `f_${string}`;

export const ORG_NAME_MAX = 60;
/** Accounts that can run one organizer. */
export const ORG_UIDS_MAX = 10;
/** Imported events one organizer can claim. */
export const ORG_CLAIMS_MAX = 60;
const IMPORTED_ID = /^[A-Za-z0-9_.-]{1,80}$/;
export const ORG_TAGLINE_MAX = 80;
export const ORG_ABOUT_MAX = 600;
export const ORG_EVENTS_MAX = 40;
export const ORG_ARTISTS_MAX = 120;
export const EVENT_NAME_MAX = 80;
export const EVENT_ABOUT_MAX = 600;
export const EVENT_PLACE_MAX = 80;
export const LINEUP_MAX = 40;
export const ARTIST_BIO_MAX = 300;
export const REQUEST_TEXT_MAX = 1000;
export const REQUEST_REPLY_MAX = 1000;
/** How long a promotion can be asked for. */
export const PROMO_DAYS = [3, 7, 14, 30] as const;
/** What a design can be asked for. */
export const DESIGN_FOR = ['Badge', 'Sticker', 'Sprout or creature', 'Gift', 'Flyer or poster', 'Something else'] as const;
export const REQUEST_KINDS: readonly OrgRequestKind[] = ['promotion', 'design', 'gift', 'other'];
export const REQUEST_LABEL: Record<OrgRequestKind, string> = { promotion: 'Promotion', design: 'Design', gift: 'Gift', other: 'Message' };

const ORG_ID = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const EVENT_ID = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isOrgId = (x: unknown): x is string => typeof x === 'string' && ORG_ID.test(x);
export const isEventId = (x: unknown): x is string => typeof x === 'string' && EVENT_ID.test(x);
export const isDay = (x: unknown): x is string => typeof x === 'string' && DAY.test(x) && !Number.isNaN(Date.parse(`${x}T12:00:00Z`));
export const isTime = (x: unknown): x is string => typeof x === 'string' && TIME.test(x);

const text = (x: unknown, max: number) => (typeof x === 'string' ? x.replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim().slice(0, max) : '');
const oneLine = (x: unknown, max: number) => text(x, max).replace(/\s+/g, ' ');
export const httpsLink = (x: unknown): string | undefined => {
  const s = typeof x === 'string' ? x.trim() : '';
  return s.length <= 2000 && /^https:\/\/[^\s/?#]+\.[^\s]+$/i.test(s) ? s : undefined;
};
export const cleanInstagram = (x: unknown): string | undefined => {
  const s = (typeof x === 'string' ? x : '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(s) ? s : undefined;
};
export const cleanSoundcloud = (x: unknown): string | undefined => {
  const s = httpsLink(x);
  return s && /^https:\/\/(www\.|m\.)?soundcloud\.com\/[a-z0-9_-]+/i.test(s) ? s.replace(/^https:\/\/(www\.|m\.)/i, 'https://') : undefined;
};
const cleanColor = (x: unknown) => (typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x) ? x.toUpperCase() : undefined);
/** Only set what's there, so documents never carry empty fields. */
const some = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;

/** A safe id from a name: "Transmutation: Nov 14" -> "transmutation-nov-14". */
export function slugOf(s: string, max = 40): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max)
      .replace(/-+$/g, '') || 'event'
  );
}

/** Names folded for matching: lower case, letters and digits only. */
export const foldName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');

export function cleanAct(raw: unknown): OrgAct | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const name = oneLine(r.name, 60);
  if (!name) return undefined;
  const start = isTime(r.start) ? r.start : undefined;
  const end = start && isTime(r.end) ? r.end : undefined;
  return some({ name, artistId: typeof r.artistId === 'string' && /^[a-z0-9-]{1,80}$/.test(r.artistId) ? r.artistId : undefined, start, end });
}

export function cleanEvent(raw: unknown): OrgEvent | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const name = oneLine(r.name, EVENT_NAME_MAX);
  if (!isEventId(r.id) || !name || !isDay(r.date)) return undefined;
  const endDate = isDay(r.endDate) && r.endDate > r.date ? r.endDate : undefined;
  const seen = new Set<string>();
  const lineup = (Array.isArray(r.lineup) ? r.lineup : [])
    .map(cleanAct)
    .filter((a): a is OrgAct => !!a && !seen.has(foldName(a.name)) && !!seen.add(foldName(a.name)))
    .slice(0, LINEUP_MAX);
  return some({
    id: r.id,
    name,
    date: r.date,
    endDate,
    doors: isTime(r.doors) ? r.doors : undefined,
    venue: oneLine(r.venue, EVENT_PLACE_MAX),
    city: oneLine(r.city, EVENT_PLACE_MAX),
    about: text(r.about, EVENT_ABOUT_MAX) || undefined,
    tickets: httpsLink(r.tickets),
    poster: httpsLink(r.poster),
    afterOf: typeof r.afterOf === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(r.afterOf) ? r.afterOf : undefined,
    lineup,
    published: r.published === true,
    from: typeof r.from === 'string' && IMPORTED_ID.test(r.from) && (r.fromKind === 'festival' || r.fromKind === 'show') ? r.from : undefined,
    fromKind: typeof r.from === 'string' && IMPORTED_ID.test(r.from) && (r.fromKind === 'festival' || r.fromKind === 'show') ? r.fromKind : undefined,
  }) as OrgEvent;
}

export function cleanOrgArtist(raw: unknown): OrgArtist | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const name = oneLine(r.name, 60);
  if (!name) return undefined;
  const sounds = Array.isArray(r.sounds) ? [...new Set(r.sounds.filter((s): s is SoundTag => (SOUND_TAGS as readonly string[]).includes(s as string)))].slice(0, 3) : [];
  return some({
    name,
    photo: httpsLink(r.photo),
    soundcloud: cleanSoundcloud(r.soundcloud),
    instagram: cleanInstagram(r.instagram),
    bio: text(r.bio, ARTIST_BIO_MAX) || undefined,
    sounds: sounds.length ? sounds : undefined,
  }) as OrgArtist;
}

/** An organizer's page as stored, checked: anything unusable is left out. Null when it isn't an organizer page at all. */
export function cleanOrg(id: string, raw: unknown): Org | null {
  if (!isOrgId(id) || !raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = oneLine(r.name, ORG_NAME_MAX);
  if (!name) return null;
  const ids = new Set<string>();
  const events = (Array.isArray(r.events) ? r.events : [])
    .map(cleanEvent)
    .filter((e): e is OrgEvent => !!e && !ids.has(e.id) && !!ids.add(e.id))
    .slice(0, ORG_EVENTS_MAX);
  const artists: Record<string, OrgArtist> = {};
  if (r.artists && typeof r.artists === 'object')
    for (const [k, v] of Object.entries(r.artists as Record<string, unknown>).slice(0, ORG_ARTISTS_MAX)) {
      const a = cleanOrgArtist(v);
      if (a && /^[a-z0-9-]{1,80}$/.test(k)) artists[k] = a;
    }
  const promoted: Record<string, string> = {};
  if (r.promoted && typeof r.promoted === 'object')
    for (const [k, v] of Object.entries(r.promoted as Record<string, unknown>)) if (isEventId(k) && isDay(v)) promoted[k] = v;
  return some({
    id,
    name,
    tagline: oneLine(r.tagline, ORG_TAGLINE_MAX) || undefined,
    about: text(r.about, ORG_ABOUT_MAX) || undefined,
    website: httpsLink(r.website),
    instagram: cleanInstagram(r.instagram),
    mark: r.mark === 'alchemy' ? ('alchemy' as const) : undefined,
    logoUrl: httpsLink(r.logoUrl),
    iconUrl: httpsLink(r.iconUrl),
    color: cleanColor(r.color),
    events,
    artists,
    promoted,
    claims: Array.isArray(r.claims) ? [...new Set(r.claims.filter((c): c is string => typeof c === 'string' && IMPORTED_ID.test(c)))].slice(0, ORG_CLAIMS_MAX) : [],
    handle: typeof r.handle === 'string' && /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/.test(r.handle) ? r.handle : undefined,
    uids: Array.isArray(r.uids) ? [...new Set(r.uids.filter((u): u is string => typeof u === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(u)))].slice(0, ORG_UIDS_MAX) : [],
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
  }) as Org;
}

/** The fields an organizer's page is saved with (besides `promoted` and `updatedAt`). */
export const ORG_FIELDS = ['name', 'tagline', 'about', 'website', 'instagram', 'mark', 'logoUrl', 'iconUrl', 'color', 'events', 'artists', 'claims'] as const;

/** What an organizer saves (everything but `promoted`, `uids` and `handle`, which only HQ sets, and the time). */
export function orgToDoc(org: Org): Record<string, unknown> {
  const { id: _id, promoted: _p, uids: _a, handle: _h, updatedAt: _u, ...rest } = org;
  return JSON.parse(JSON.stringify(rest)) as Record<string, unknown>;
}

/** A new organizer page from its starter. */
export function orgFromStarter(s: OrgStarter): Org {
  return some({ id: s.id, name: s.name, tagline: s.tagline, website: s.website, instagram: s.instagram, mark: s.mark, color: s.color, handle: s.handle, events: [], artists: {}, claims: [], promoted: {}, uids: [] }) as Org;
}

/** A new event's id from its name and night, not already used. */
export function newEventId(org: Pick<Org, 'events'>, name: string, date: string): string {
  const base = slugOf(`${name} ${date.slice(5)}`, 36);
  let id = base;
  for (let i = 2; org.events.some((e) => e.id === id); i++) id = `${base}-${i}`;
  return id;
}

// ---- Festivals from events ------------------------------------------------

/** An event's festival id on Afterglow: "underground-alchemy--transmutation-11-14". */
export const eventFestivalId = (orgId: string, eventId: string) => `${orgId}--${eventId}`;
/** An event's festival id: the imported festival's own when it's a copy of one (so it shows in its place), else the organizer's. */
export const eventFestivalIdOf = (org: Pick<Org, 'id'>, e: Pick<OrgEvent, 'id' | 'from' | 'fromKind'>) => (e.from && e.fromKind === 'festival' ? e.from : eventFestivalId(org.id, e.id));
/** The organizer's event shown as this festival, if any. */
export const eventAt = (org: Pick<Org, 'id' | 'events'>, festivalId: string) => org.events.find((e) => eventFestivalIdOf(org, e) === festivalId);
/** The organizer and event behind a festival id, if it's one of theirs. */
export function eventOf(festivalId: string): { orgId: string; eventId: string } | undefined {
  const i = festivalId.indexOf('--');
  if (i <= 0) return undefined;
  const orgId = festivalId.slice(0, i);
  const eventId = festivalId.slice(i + 2);
  return isOrgId(orgId) && isEventId(eventId) ? { orgId, eventId } : undefined;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const at = (day: string) => new Date(`${day}T12:00:00Z`);
export const weekdayOf = (day: string) => WEEKDAYS[at(day).getUTCDay()];
/** The nights from the first to the last, "YYYY-MM-DD" each (at most 7). */
export function nightsOf(e: Pick<OrgEvent, 'date' | 'endDate'>): string[] {
  const out = [e.date];
  if (!e.endDate) return out;
  for (let d = at(e.date); out.length < 7; ) {
    d = new Date(d.getTime() + 86_400_000);
    const k = d.toISOString().slice(0, 10);
    if (k > e.endDate) break;
    out.push(k);
  }
  return out;
}
/** The catalogue's words for when it is, in English like the catalogue: "Nov 14", "Nov 14 to 15", "Nov 30 to Dec 1". */
export function datesText(e: Pick<OrgEvent, 'date' | 'endDate'>): string {
  const [, m1, d1] = e.date.split('-').map(Number);
  if (!e.endDate) return `${MONTHS[m1 - 1]} ${d1}`;
  const [, m2, d2] = e.endDate.split('-').map(Number);
  return m1 === m2 ? `${MONTHS[m1 - 1]} ${d1} to ${d2}` : `${MONTHS[m1 - 1]} ${d1} to ${MONTHS[m2 - 1]} ${d2}`;
}

/** Looks up the artists already on Afterglow, by folded name. */
export type ArtistIndex = { byId: Map<string, Artist>; byName: Map<string, string> };
export function artistIndex(artists: readonly Artist[]): ArtistIndex {
  const byName = new Map<string, string>();
  for (const a of artists) if (!byName.has(foldName(a.name))) byName.set(foldName(a.name), a.id);
  return { byId: new Map(artists.map((a) => [a.id, a])), byName };
}

/**
 * Who an act is on Afterglow: the artist the organizer picked, the artist
 * with that name, or a new artist (an id from the name; one that would clash
 * with a different artist gets the organizer's id on the end).
 */
export function actArtistId(act: OrgAct, index: ArtistIndex, orgId: string): { id: string; isNew: boolean } {
  if (act.artistId && index.byId.has(act.artistId)) return { id: act.artistId, isNew: false };
  const known = index.byName.get(foldName(act.name));
  if (known) return { id: known, isNew: false };
  const id = slugOf(act.name, 60);
  return index.byId.has(id) ? { id: `${id}-${orgId}`.slice(0, 80), isNew: true } : { id, isNew: true };
}

/** Every act across an organizer's events, once each, with who they are on Afterglow (the studio's Artists tab). */
export function orgActs(org: Org, index: ArtistIndex, onlyPublished = false): { id: string; name: string; isNew: boolean; events: string[] }[] {
  const out = new Map<string, { id: string; name: string; isNew: boolean; events: string[] }>();
  for (const e of org.events) {
    if (onlyPublished && !e.published) continue;
    for (const act of e.lineup) {
      const who = actArtistId(act, index, org.id);
      const had = out.get(who.id);
      if (had) had.events.push(e.name);
      else out.set(who.id, { id: who.id, name: index.byId.get(who.id)?.name ?? act.name, isNew: who.isNew, events: [e.name] });
    }
  }
  return [...out.values()];
}

/** An event as a festival: one stage (the venue), its nights, its set times. */
export function eventToFestival(org: Org, e: OrgEvent, index: ArtistIndex): { festival: Festival; acts: { id: string; name: string; isNew: boolean }[] } {
  const nights = nightsOf(e);
  const days = nights.map(weekdayOf);
  const acts = e.lineup.map((a) => ({ ...actArtistId(a, index, org.id), name: a.name, act: a }));
  const lineup = [...new Set(acts.map((a) => a.id))];
  const sets: SetTime[] = acts.filter((a) => a.act.start && a.act.end).map((a) => ({ artistId: a.id, day: days[0], stageId: 'main', start: a.act.start!, end: a.act.end! }));
  const links = some({ tickets: e.tickets, website: org.website });
  const festival: Festival = {
    id: eventFestivalIdOf(org, e),
    name: e.name,
    dates: datesText(e),
    location: [e.venue, e.city].filter(Boolean).join(', '),
    lineup,
    days,
    stages: [{ id: 'main', name: e.venue || 'Main room' }],
    startDate: e.date,
    endDate: e.endDate ?? e.date,
    organizer: org.id,
    ...(e.afterOf ? { afterOf: e.afterOf } : {}),
    ...(sets.length ? { sets } : {}),
    ...(Object.keys(links).length ? { links } : {}),
    ...(e.poster ? { posterImageUrl: e.poster } : {}),
  };
  return { festival, acts: acts.map(({ id, name, isNew }) => ({ id, name, isNew })) };
}

/** An artist with what their organizer says laid over: words always; a photo, SoundCloud and sounds only where Afterglow has none. */
export function withOrgWords(a: Artist, org: Pick<Org, 'id' | 'name'>, words: OrgArtist | undefined): Artist {
  if (!words) return a;
  const next: Artist = { ...a };
  if (words.bio || words.instagram) next.org = some({ id: org.id, name: org.name, bio: words.bio, instagram: words.instagram });
  if (!a.imageUrl && words.photo) next.imageUrl = words.photo;
  if (!a.soundcloud && words.soundcloud) next.soundcloud = words.soundcloud;
  const hasSound = Object.keys(a.sound ?? {}).length > 0 && !a.soundGuessed;
  if (!hasSound && words.sounds?.length) {
    next.sound = Object.fromEntries(words.sounds.map((s, i) => [s, i === 0 ? 1 : 0.6]));
    delete next.soundGuessed;
  }
  return next;
}

/**
 * The catalogue with organizers laid over it, never changing what was
 * imported (that stays as the nightly feed wrote it; this is worked out on
 * the phone):
 * - published events added after everything else (so they never become the
 *   festival Discover opens on), never over a festival already there;
 * - a published copy of an imported festival shown in its place (same id,
 *   keeping its spot on the map); a published copy of an imported show
 *   hides that show (its festival page takes over);
 * - imported festivals and shows an organizer claimed marked as theirs;
 * - organizers' words laid over the artists they book.
 * The same object when there's nothing to do. Pure.
 */
export function withOrgs(base: CatalogSnapshot, orgs: readonly Org[]): CatalogSnapshot {
  if (!orgs.length) return base;
  const index = artistIndex(base.artists);
  const baseFestivals = new Map(base.festivals.map((f) => [f.id, f]));
  const baseShows = new Set((base.shows ?? []).map((s) => s.id));
  const taken = new Set(baseFestivals.keys());
  const replaced = new Map<string, Festival>();
  const added: Festival[] = [];
  const hiddenShows = new Set<string>();
  const claimedFestivals = new Map<string, string>();
  const claimedShows = new Map<string, string>();
  const artists = new Map<string, Artist>();
  for (const org of orgs) {
    for (const e of org.events) {
      if (!e.published) continue;
      const { festival, acts } = eventToFestival(org, e, index);
      if (e.from && e.fromKind === 'festival') {
        const was = baseFestivals.get(e.from);
        if (replaced.has(e.from)) continue;
        if (was) replaced.set(e.from, was.place && !festival.place ? { ...festival, place: was.place } : festival);
        else if (taken.has(festival.id)) continue;
        else added.push(festival);
      } else {
        if (taken.has(festival.id)) continue;
        added.push(festival);
        if (e.from && e.fromKind === 'show') hiddenShows.add(e.from);
      }
      taken.add(festival.id);
      for (const act of acts) {
        const had = artists.get(act.id) ?? index.byId.get(act.id) ?? { id: act.id, name: act.name, sound: {} };
        artists.set(act.id, withOrgWords(had, org, org.artists[act.id]));
      }
    }
    for (const c of org.claims) {
      if (baseFestivals.has(c) && !claimedFestivals.has(c)) claimedFestivals.set(c, org.id);
      else if (baseShows.has(c) && !claimedShows.has(c)) claimedShows.set(c, org.id);
    }
  }
  if (!replaced.size && !added.length && !claimedFestivals.size && !claimedShows.size) return base;
  const known = new Set(base.artists.map((a) => a.id));
  const out: CatalogSnapshot = {
    ...base,
    artists: [...base.artists.map((a) => artists.get(a.id) ?? a), ...[...artists.values()].filter((a) => !known.has(a.id))],
    festivals: [
      ...base.festivals.map((f) => replaced.get(f.id) ?? (claimedFestivals.has(f.id) && !f.organizer ? { ...f, organizer: claimedFestivals.get(f.id) } : f)),
      ...added,
    ],
  };
  if (base.shows) out.shows = base.shows.filter((s) => !hiddenShows.has(s.id)).map((s) => (claimedShows.has(s.id) && !s.organizer ? { ...s, organizer: claimedShows.get(s.id) } : s));
  return out;
}

// ---- Imported events (EDMTrain) --------------------------------------------

/** One line on an organizer's page: its own event, or an imported one it claimed. */
export type Listing = { key: string; name: string; date: string; endDate?: string; venue: string; city: string; href: string; imported: boolean };

/** "Venue, Orlando, FL" -> venue "Venue", city "Orlando, FL"; a place with no comma is the city. */
export function splitPlace(location: string): { venue: string; city: string } {
  const i = location.indexOf(',');
  return i < 0 ? { venue: '', city: location.trim() } : { venue: location.slice(0, i).trim(), city: location.slice(i + 1).trim() };
}

export type Lookups = { festival: (id: string) => Festival | undefined; show: (id: string) => Show | undefined };

/** What an imported festival or show looks like as a line (undefined when it isn't on Afterglow, or has no date). */
export function importedListing(id: string, look: Lookups): Listing | undefined {
  const f = look.festival(id);
  if (f?.startDate) {
    const { venue, city } = splitPlace(f.location);
    return { key: `f:${id}`, name: f.name, date: f.startDate, ...(f.endDate && f.endDate !== f.startDate ? { endDate: f.endDate } : {}), venue, city, href: `/festival/${id}`, imported: true };
  }
  const s = look.show(id);
  if (s) return { key: `s:${id}`, name: s.name ?? s.venue, date: s.date, venue: s.name ? s.venue : '', city: s.location, href: `/show/${id}`, imported: true };
  return undefined;
}

/** An organizer's page: its published events and the imported ones it claimed (not ones it copied), coming up soonest first, past newest first. */
export function orgListings(org: Org, look: Lookups, today: string): { upcoming: Listing[]; past: Listing[] } {
  const copied = new Set(org.events.filter((e) => e.published && e.from).map((e) => e.from!));
  const own: Listing[] = org.events
    .filter((e) => e.published)
    .map((e) => ({ key: `e:${e.id}`, name: e.name, date: e.date, ...(e.endDate ? { endDate: e.endDate } : {}), venue: e.venue, city: e.city, href: `/festival/${eventFestivalIdOf(org, e)}`, imported: false }));
  const claimed = org.claims.filter((c) => !copied.has(c)).flatMap((c) => importedListing(c, look) ?? []);
  const all = [...own, ...claimed];
  const last = (l: Listing) => l.endDate ?? l.date;
  return {
    upcoming: all.filter((l) => last(l) >= today).sort((a, b) => a.date.localeCompare(b.date)),
    past: all.filter((l) => last(l) < today).sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/** Whether an imported event's words match what's typed (its name, venue or town). */
const matches = (q: string, ...words: (string | undefined)[]) => words.some((w) => !!w && foldName(w).includes(q));

/**
 * Imported events an organizer might claim, still to come: matching what's
 * typed, or (nothing typed) ones that carry its name or play its venues.
 * Festivals from EDMTrain and every show (shows all come from it). Not ones
 * it already claimed. Up to `max`, soonest first.
 */
export function importedCandidates(org: Org, festivals: readonly Festival[], shows: readonly Show[], query: string, today: string, max = 12): { id: string; kind: 'festival' | 'show'; listing: Listing }[] {
  const q = foldName(query);
  const hints = q.length >= 2 ? [q] : [...new Set([...org.name.split(/\s+/).map(foldName).filter((w) => w.length >= 5), ...org.events.map((e) => foldName(e.venue)).filter((v) => v.length >= 4)])];
  if (!hints.length) return [];
  const claimed = new Set(org.claims);
  const look: Lookups = { festival: (id) => festivals.find((f) => f.id === id), show: (id) => shows.find((s) => s.id === id) };
  const out: { id: string; kind: 'festival' | 'show'; listing: Listing }[] = [];
  for (const f of festivals) {
    if (f.organizer || f.source?.name !== 'EDMTrain' || claimed.has(f.id) || (f.endDate ?? f.startDate ?? '') < today) continue;
    if (hints.some((h) => matches(h, f.name, f.location))) out.push({ id: f.id, kind: 'festival', listing: importedListing(f.id, look)! });
  }
  for (const s of shows) {
    if (s.organizer || claimed.has(s.id) || s.date < today) continue;
    if (hints.some((h) => matches(h, s.name, s.venue, s.location))) out.push({ id: s.id, kind: 'show', listing: importedListing(s.id, look)! });
  }
  return out.filter((c) => !!c.listing).sort((a, b) => a.listing.date.localeCompare(b.listing.date)).slice(0, max);
}

/** A new event in the studio, filled in from an imported one, to edit on Afterglow (a draft until published). */
export function draftFrom(org: Pick<Org, 'events'>, id: string, look: Lookups, artistName: (id: string) => string | undefined): OrgEvent | undefined {
  const f = look.festival(id);
  const s = f ? undefined : look.show(id);
  if (f?.startDate) {
    const { venue, city } = splitPlace(f.location);
    return {
      id: newEventId(org, f.name, f.startDate),
      name: f.name.slice(0, EVENT_NAME_MAX),
      date: f.startDate,
      ...(f.endDate && f.endDate > f.startDate ? { endDate: f.endDate } : {}),
      venue: venue.slice(0, EVENT_PLACE_MAX),
      city: city.slice(0, EVENT_PLACE_MAX),
      ...(f.links?.tickets ? { tickets: f.links.tickets } : {}),
      ...(f.posterImageUrl ? { poster: f.posterImageUrl } : {}),
      lineup: f.lineup.slice(0, LINEUP_MAX).flatMap((a) => (artistName(a) ? [{ name: artistName(a)!, artistId: a }] : [])),
      published: false,
      from: id,
      fromKind: 'festival',
    };
  }
  if (s) {
    const name = s.name ?? s.venue;
    return {
      id: newEventId(org, name, s.date),
      name: name.slice(0, EVENT_NAME_MAX),
      date: s.date,
      venue: s.venue.slice(0, EVENT_PLACE_MAX),
      city: s.location.slice(0, EVENT_PLACE_MAX),
      ...(httpsLink(s.link) ? { tickets: s.link } : {}),
      lineup: s.artistIds.slice(0, LINEUP_MAX).flatMap((a) => (artistName(a) ? [{ name: artistName(a)!, artistId: a }] : [])),
      published: false,
      from: id,
      fromKind: 'show',
    };
  }
  return undefined;
}

/** A profile @handle from a name: "Underground Alchemy" -> "undergroundalchemy" (3 to 20 letters and numbers). */
export const handleFor = (name: string) => {
  const h = slugOf(name, 60).replace(/-/g, '').slice(0, 20);
  return h.length >= 3 ? h : undefined;
};

/** The profile an account that runs this organizer should show: its name and @handle, no favourite artists or sounds. */
export function orgProfileInput(org: Pick<Org, 'name' | 'tagline' | 'handle'>, bio: string | undefined) {
  const handle = org.handle ?? handleFor(org.name);
  return handle ? { handle, displayName: org.name.slice(0, 40), bio: (bio || org.tagline || '').slice(0, 160), showFestivals: false, showSound: false, showArtists: false } : undefined;
}

/** One DJ an organizer books, with what's worth knowing. */
export type OrgDj = { artistId: string; name: string; events: number; upcoming: number; next?: string; sound?: SoundTag };

/**
 * The DJs on an organizer's published events and claimed festivals: how many
 * of its events each plays, how many still to come and the next one, and
 * their main sound. Most booked first. Pure.
 */
export function orgDjs(org: Org, look: Pick<Lookups, 'festival' | 'show'>, artists: readonly Artist[], today: string): OrgDj[] {
  const index = artistIndex(artists);
  const artist = (id: string) => index.byId.get(id);
  const nights = new Map<string, string[]>();
  const add = (id: string, date: string) => nights.set(id, [...(nights.get(id) ?? []), date]);
  for (const e of org.events) {
    if (!e.published) continue;
    for (const act of e.lineup) {
      add(actArtistId(act, index, org.id).id, e.date);
    }
  }
  const copied = new Set(org.events.filter((e) => e.published && e.from).map((e) => e.from!));
  for (const c of org.claims) {
    if (copied.has(c)) continue;
    const f = look.festival(c);
    const s = f ? undefined : look.show(c);
    if (f?.startDate) for (const id of f.lineup) add(id, f.startDate);
    else if (s) for (const id of s.artistIds) add(id, s.date);
  }
  const out: OrgDj[] = [];
  for (const [id, dates] of nights) {
    const a = artist(id);
    if (!a) continue;
    const coming = dates.filter((d) => d >= today).sort();
    const sound = (Object.entries(a.sound ?? {}) as [SoundTag, number][]).sort((x, y) => y[1] - x[1])[0]?.[0];
    out.push({ artistId: id, name: a.name, events: dates.length, upcoming: coming.length, ...(coming[0] ? { next: coming[0] } : {}), ...(sound ? { sound } : {}) });
  }
  return out.sort((a, b) => b.events - a.events || (a.next ?? '9999').localeCompare(b.next ?? '9999') || a.name.localeCompare(b.name));
}

/** The organizer an account runs, by account (HQ linked it, or it linked itself). */
export const orgOfAccount = (orgs: readonly Org[], uid: string | undefined): Org | undefined => (uid ? orgs.find((o) => o.uids.includes(uid)) : undefined);

/**
 * Organizers whose name, @handle or Instagram matches a search ("under",
 * "alchemy", "@undergroundalchemy"), best first: names that start with it,
 * then words that do, then the rest. Nothing for an empty search. Pure.
 */
export function searchOrgs(orgs: readonly Org[], query: string, max = 3): Org[] {
  const raw = query.trim();
  const plain = raw.replace(/^@+/, '');
  if (plain.length < 2) return [];
  const q = normalize(plain);
  const handles = (o: Org) => [o.handle, o.instagram].filter((x): x is string => !!x);
  return orgs
    .map((o, i) => {
      if (!raw.startsWith('@') && matchesName(o.name, plain)) return { o, i, r: nameRank(o.name, q) };
      const h = handles(o).filter((x) => matchesName(x, plain));
      return { o, i, r: h.length ? 3 + Math.min(...h.map((x) => nameRank(x, q))) : -1 };
    })
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, max)
    .map((x) => x.o);
}

/**
 * A search's festivals or shows with the found organizers' own events added
 * after them (each once), so typing an organizer's name finds what it hosts.
 */
export function withHosted<T extends { id: string; organizer?: string }>(found: readonly T[], all: readonly T[], orgs: readonly Org[], max = Infinity): T[] {
  if (!orgs.length) return [...found];
  const ids = new Set(orgs.map((o) => o.id));
  const seen = new Set(found.map((x) => x.id));
  return [...found, ...all.filter((x) => x.organizer && ids.has(x.organizer) && !seen.has(x.id))].slice(0, Math.max(max, found.length));
}

// ---- Updates to followers ---------------------------------------------------

/** An update is at most this long. */
export const POST_TEXT_MAX = 280;
/** What an organizer sends its followers: a few words, maybe an event of its and a gift (one of its gift stickers, by code). */
export type OrgPostInput = { text: string; festivalId?: string; gift?: string; giftName?: string };
export type OrgPost = OrgPostInput & { id: string; orgId: string; uid: string; createdAt: string };

/** An update ready to send: trimmed and capped; nothing when there are no words. */
export function cleanPostInput(input: OrgPostInput): OrgPostInput | undefined {
  const text = input.text.trim().slice(0, POST_TEXT_MAX);
  if (!text) return undefined;
  const festivalId = input.festivalId?.trim().slice(0, 120);
  const gift = input.gift && /^[a-z0-9]{6,24}$/.test(input.gift) ? input.gift : undefined;
  const giftName = gift ? input.giftName?.trim().slice(0, 60) : undefined;
  return { text, ...(festivalId ? { festivalId } : {}), ...(gift ? { gift } : {}), ...(giftName ? { giftName } : {}) };
}

/** The organizers whose accounts you follow (their updates reach you). */
export const followedOrgs = (orgs: readonly Org[], following: ReadonlySet<string>): Org[] => orgs.filter((o) => o.uids.some((u) => following.has(u)));

/** Where an update opens: its gift to collect, else its event, else the organizer's page. */
export const postHref = (p: Pick<OrgPost, 'orgId' | 'festivalId' | 'gift'>) => (p.gift ? `/find/${p.gift}` : p.festivalId ? `/festival/${p.festivalId}` : `/org/${p.orgId}`);

/** Updates from organizers you follow, for the bell: who it's from (or that it's a gift from them) and what they said. */
export function orgPostNotices(posts: readonly OrgPost[], orgs: readonly Org[]): Notice[] {
  return posts.flatMap((p) => {
    const org = orgs.find((o) => o.id === p.orgId);
    if (!org) return [];
    const at = Date.parse(p.createdAt);
    return [{ id: `org:${p.id}`, kind: 'org' as const, title: p.gift ? t('A gift from {organizer}', { organizer: org.name }) : org.name, body: p.text, href: postHref(p), ...(Number.isFinite(at) ? { at } : {}) }];
  });
}

// ---- Promotion --------------------------------------------------------------

export type Promoted = { org: Org; event: OrgEvent; festivalId: string; until: string };

/** Events HQ promotes now: published, not over, promotion not ended. Soonest first. */
export function activePromotions(orgs: readonly Org[], today: string): Promoted[] {
  const out: Promoted[] = [];
  for (const org of orgs)
    for (const e of org.events) {
      const until = org.promoted[e.id];
      if (!until || !e.published || until < today || (e.endDate ?? e.date) < today) continue;
      out.push({ org, event: e, festivalId: eventFestivalIdOf(org, e), until });
    }
  return out.sort((a, b) => a.event.date.localeCompare(b.event.date));
}

/** The last day of a promotion that starts today and lasts `days` days, never past the event's last night. */
export function promotionUntil(today: string, days: number, e: Pick<OrgEvent, 'date' | 'endDate'>): string {
  const end = new Date(at(today).getTime() + (Math.max(1, days) - 1) * 86_400_000).toISOString().slice(0, 10);
  const last = e.endDate ?? e.date;
  return end < last ? end : last;
}

/** Upcoming (not over yet) and past events, published ones only unless `all`. */
export function splitEvents(org: Org, today: string, all = false): { upcoming: OrgEvent[]; past: OrgEvent[] } {
  const shown = org.events.filter((e) => all || e.published);
  return {
    upcoming: shown.filter((e) => (e.endDate ?? e.date) >= today).sort((a, b) => a.date.localeCompare(b.date)),
    past: shown.filter((e) => (e.endDate ?? e.date) < today).sort((a, b) => b.date.localeCompare(a.date)),
  };
}

// ---- Numbers ------------------------------------------------------------------

/** Today in UTC, "YYYY-MM-DD" (the day a view is counted on). */
export const utcDay = (now: Date) => now.toISOString().slice(0, 10);
export const counterKey = (k: OrgCounter) => k;
export const isCounter = (k: unknown): k is OrgCounter => typeof k === 'string' && /^(page|promo|tickets|e_[a-z0-9-]{1,40}|f_[a-z0-9]{6,24})$/.test(k);

/** How many people found each of an organizer's stickers and gifts (code -> count), from its numbers. */
export function findsByCode(rows: readonly OrgDay[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) for (const [k, n] of Object.entries(r.counts)) if (k.startsWith('f_') && n > 0) out[k.slice(2)] = (out[k.slice(2)] ?? 0) + n;
  return out;
}

/** The first day of the last `days` days. */
export const sinceDay = (now: Date, days: number) => utcDay(new Date(now.getTime() - (days - 1) * 86_400_000));

export type OrgStats = {
  page: number;
  events: number;
  tickets: number;
  promo: number;
  /** Stickers and gifts found. */
  finds: number;
  /** Event id -> page views. */
  byEvent: Record<string, number>;
  /** Day by day, oldest first, every view counted. */
  byDay: { day: string; n: number }[];
};

/** The numbers over the last `days` days. */
export function orgStats(rows: readonly OrgDay[], now: Date, days: number): OrgStats {
  const from = sinceDay(now, days);
  const stats: OrgStats = { page: 0, events: 0, tickets: 0, promo: 0, finds: 0, byEvent: {}, byDay: [] };
  const perDay = new Map<string, number>();
  for (const r of rows) {
    if (r.day < from) continue;
    for (const [k, n] of Object.entries(r.counts)) {
      if (!(n > 0)) continue;
      if (k === 'page') stats.page += n;
      else if (k === 'tickets') stats.tickets += n;
      else if (k === 'promo') stats.promo += n;
      else if (k.startsWith('f_')) stats.finds += n;
      else if (k.startsWith('e_')) {
        stats.events += n;
        stats.byEvent[k.slice(2)] = (stats.byEvent[k.slice(2)] ?? 0) + n;
      }
      // Views only (promoted views and finds are their own numbers).
      if (k !== 'promo' && !k.startsWith('f_')) perDay.set(r.day, (perDay.get(r.day) ?? 0) + n);
    }
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = utcDay(new Date(now.getTime() - i * 86_400_000));
    stats.byDay.push({ day: d, n: perDay.get(d) ?? 0 });
  }
  return stats;
}

/** "1.2k", "940". */
export const shortCount = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n));

/** The words that go with a gift link. */
export function giftShareText(orgName: string, note: string | undefined, link: string): string {
  return `${note ? `${note}\n\n` : ''}A gift from ${orgName} on Afterglow: ${link}`;
}
