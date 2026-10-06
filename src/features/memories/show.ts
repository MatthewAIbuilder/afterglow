import type { Artist, Show } from '../../data/models';
import { matchesName, nameRank, normalize } from '../festivals/search';

/**
 * One-night shows on a video: a club night or concert rather than a
 * festival ("Slander at Echostage"). Pure. Afterglow's shows (the nightly
 * EDMTrain feed) only list nights still to come, plus the ones that just
 * happened while they're in the file, so finding one searches those around
 * the day the video was filmed, and anything else can be typed in (the
 * venue, or the night's name). The date is the day it was filmed.
 */
export type ShowTag = {
  /** The night's name, or its venue: "Echostage". */
  name: string;
  /** The day, "YYYY-MM-DD" (local). */
  date: string;
  /** Its town, when known: "Washington". */
  city?: string;
  /** The show on Afterglow, when it was one of theirs ("edm-123456"). */
  showId?: string;
};

export const SHOW_NAME_MAX = 60;
export const SHOW_CITY_MAX = 60;
/** Shows this many days either side of the day it was filmed (a set after midnight is still that night's show). */
export const SHOW_DAYS_AROUND = 1;
/** At most this many shows offered at once. */
export const SHOWS_OFFERED = 8;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, '0');

/** The local day of an ISO time, "YYYY-MM-DD". */
export function localDay(iso: string): string {
  const t = Date.parse(iso);
  const d = Number.isFinite(t) ? new Date(t) : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Days between two "YYYY-MM-DD" days (b minus a). */
const daysBetween = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86_400_000);

/** "Denver, CO" → "Denver". */
const townOf = (location: string) => location.split(',')[0]?.trim() || undefined;

/** A show from Afterglow's list, as a tag. */
export function showTagOf(s: Show): ShowTag {
  const city = townOf(s.location);
  return { name: (s.name?.trim() || s.venue).slice(0, SHOW_NAME_MAX), date: s.date, ...(city ? { city: city.slice(0, SHOW_CITY_MAX) } : {}), showId: s.id };
}

/** A name someone typed, tidied: spaces collapsed, at most SHOW_NAME_MAX. */
export const cleanShowName = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, SHOW_NAME_MAX).trim();

/** "Echostage", or "Echostage, Washington" when the town isn't already in the name. */
export const showLabel = (s: Pick<ShowTag, 'name' | 'city'>) => (s.city && !normalize(s.name).includes(normalize(s.city)) ? `${s.name}, ${s.city}` : s.name);

/** One show's key: Afterglow's id, or the same name on the same day, whoever typed it. */
export const showKey = (s: ShowTag) => s.showId ?? `${normalize(s.name).replace(/\s+/g, '-').slice(0, 60) || 'show'}-${s.date}`;

/** A show read back from storage or a shared video; undefined when it isn't one. */
export function cleanShow(raw: unknown): ShowTag | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? cleanShowName(o.name) : '';
  const date = typeof o.date === 'string' && DAY.test(o.date) ? o.date : undefined;
  if (!name || !date) return undefined;
  const city = typeof o.city === 'string' && o.city.trim() ? o.city.trim().slice(0, SHOW_CITY_MAX) : undefined;
  const showId = typeof o.showId === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(o.showId) ? o.showId : undefined;
  return { name, date, ...(city ? { city } : {}), ...(showId ? { showId } : {}) };
}

/**
 * Shows to offer for a video filmed `capturedAt`: Afterglow's shows within a
 * day of it, the ones with an artist you picked first, then the ones in your
 * town. A search matches the night's name, venue, town or anyone on the bill.
 */
export function showsAround(
  shows: readonly Show[],
  o: { capturedAt: string; query?: string; artistId?: string; city?: string; artistName: (id: string) => string | undefined },
  max = SHOWS_OFFERED,
): Show[] {
  const day = localDay(o.capturedAt);
  const q = normalize(o.query ?? '');
  const near = shows.filter((s) => DAY.test(s.date) && Math.abs(daysBetween(day, s.date)) <= SHOW_DAYS_AROUND);
  const scored = near
    .map((s, i) => {
      let rank = Math.abs(daysBetween(day, s.date));
      if (o.artistId && s.artistIds.includes(o.artistId)) rank -= 10;
      if (o.city && townOf(s.location) && normalize(townOf(s.location)!) === normalize(o.city)) rank -= 2;
      if (q) {
        const names = [s.name ?? '', s.venue, s.location, ...s.artistIds.map((id) => o.artistName(id) ?? '')].filter(Boolean);
        const hits = names.filter((n) => matchesName(n, q)).map((n) => nameRank(n, q));
        if (!hits.length) return undefined;
        rank += Math.min(...hits);
      }
      return { s, i, rank };
    })
    .filter((x): x is { s: Show; i: number; rank: number } => !!x);
  return scored
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, max)
    .map((x) => x.s);
}

/** Who to offer first for a show from Afterglow's list: its bill, in billing order. */
export function showBill(s: ShowTag | undefined, shows: readonly Show[], artist: (id: string) => Artist | undefined): Artist[] {
  if (!s?.showId) return [];
  const show = shows.find((x) => x.id === s.showId);
  return (show?.artistIds ?? []).map(artist).filter((a): a is Artist => !!a);
}

/** Your shows from your videos, each once, the most recent first (to pick again). */
export function showsOf(memories: readonly { show?: ShowTag }[]): ShowTag[] {
  const byKey = new Map<string, ShowTag>();
  for (const m of memories) if (m.show && !byKey.has(showKey(m.show))) byKey.set(showKey(m.show), m.show);
  return [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}
