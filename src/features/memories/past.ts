import type { Festival } from '../../data/models';
import { townOf } from '../badges/badges';
import { matchesName, nameRank, normalize } from '../festivals/search';

/**
 * Festivals you went to before Afterglow knew about them: a video from
 * your camera roll tagged with a past edition ("EDC Orlando 2024"). Pure.
 *
 * Afterglow's catalogue only lists festivals still to come, so finding a past
 * one searches, in order: past events you've added before, earlier years of
 * festivals on Afterglow (EDC Orlando 2026 → EDC Orlando, linked by
 * `seriesId`), and a short list of well-known festivals. Anything else can be
 * typed in. The year comes from when the video was filmed.
 */
export type PastEvent = {
  /** The festival's name without a year: "EDC Orlando". */
  name: string;
  year: number;
  /** Its town, when known: "Orlando". */
  city?: string;
  /** The same festival on Afterglow today, so its videos can show with this year's lineup. */
  seriesId?: string;
};

export const PAST_NAME_MAX = 60;
export const PAST_CITY_MAX = 60;
/** The earliest year a past festival can be from. */
export const FIRST_YEAR = 1990;

/** Where a search result came from. */
export type PastChoice = { name: string; city?: string; seriesId?: string; from: 'yours' | 'afterglow' | 'known' };

/**
 * Well-known festivals (names and towns only, nothing about their lineups),
 * so the common ones are a tap away even when they aren't on Afterglow.
 */
export const KNOWN_FESTIVALS: readonly { name: string; city?: string }[] = [
  { name: 'EDC Las Vegas', city: 'Las Vegas' },
  { name: 'EDC Orlando', city: 'Orlando' },
  { name: 'Ultra Music Festival', city: 'Miami' },
  { name: 'Tomorrowland', city: 'Boom' },
  { name: 'Lost Lands', city: 'Thornville' },
  { name: 'Electric Forest', city: 'Rothbury' },
  { name: 'Bonnaroo', city: 'Manchester' },
  { name: 'Coachella', city: 'Indio' },
  { name: 'Lollapalooza', city: 'Chicago' },
  { name: 'Austin City Limits', city: 'Austin' },
  { name: 'Electric Zoo', city: 'New York' },
  { name: 'Movement', city: 'Detroit' },
  { name: 'Shambhala', city: 'Salmo' },
  { name: 'Okeechobee Music & Arts Festival', city: 'Okeechobee' },
  { name: 'Suwannee Hulaween', city: 'Live Oak' },
  { name: 'Forbidden Kingdom', city: 'Orlando' },
  { name: 'Escape Halloween', city: 'San Bernardino' },
  { name: 'Beyond Wonderland' },
  { name: 'Nocturnal Wonderland' },
  { name: 'Dreamstate' },
  { name: 'Bass Canyon', city: 'George' },
  { name: 'Paradiso', city: 'George' },
  { name: 'Wakaan Music Festival', city: 'Ozark' },
  { name: 'Splash House', city: 'Palm Springs' },
  { name: 'Outside Lands', city: 'San Francisco' },
  { name: 'Governors Ball', city: 'New York' },
  { name: 'Creamfields', city: 'Daresbury' },
  { name: 'Mysteryland' },
  { name: 'Untold', city: 'Cluj-Napoca' },
  { name: 'Sziget', city: 'Budapest' },
];

/** A festival's name without its year or edition year: "EDC Orlando 2026" → "EDC Orlando". */
export const seriesName = (name: string) =>
  name
    .replace(/\s*[’']\d\d\b/g, '')
    .replace(/\s*\b(19|20)\d\d\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const slug = (s: string) => normalize(s).replace(/\s+/g, '-').slice(0, 60) || 'festival';

/** One past event's key: the same festival and year is the same key, whoever typed it. */
export const pastKey = (p: Pick<PastEvent, 'name' | 'year'>) => `${slug(p.name)}-${p.year}`;
/** "EDC Orlando 2024". */
export const pastLabel = (p: Pick<PastEvent, 'name' | 'year'>) => `${p.name} ${p.year}`;
/** "EDC Orlando ’24", for small spaces. */
export const pastShort = (p: Pick<PastEvent, 'name' | 'year'>) => `${p.name} ’${String(p.year).slice(2)}`;

/** The year a video was filmed (local time). */
export const yearOf = (capturedAt: string) => {
  const t = Date.parse(capturedAt);
  return Number.isFinite(t) ? new Date(t).getFullYear() : new Date().getFullYear();
};

/** Years to pick from: the year it was filmed first, then the few before it. */
export function pastYears(capturedAt: string, now: Date, count = 4): number[] {
  const top = Math.min(yearOf(capturedAt), now.getFullYear());
  return Array.from({ length: count }, (_, i) => top - i).filter((y) => y >= FIRST_YEAR);
}

/**
 * Past festivals matching a search: ones you added before, festivals on
 * Afterglow (as a series, no year), then well-known ones, each once by name.
 * With no search: yours, then Afterglow's, up to `max`.
 */
export function pastChoices(query: string, from: { festivals: readonly Festival[]; mine: readonly PastEvent[] }, max = 8): PastChoice[] {
  const all: PastChoice[] = [];
  const seen = new Set<string>();
  const add = (c: PastChoice) => {
    const k = normalize(c.name);
    if (!k || seen.has(k)) return;
    seen.add(k);
    all.push(c);
  };
  for (const p of from.mine) add({ name: p.name, city: p.city, seriesId: p.seriesId, from: 'yours' });
  for (const f of from.festivals) add({ name: seriesName(f.name), city: townOf(f.location), seriesId: f.id, from: 'afterglow' });
  for (const k of KNOWN_FESTIVALS) add({ ...k, from: 'known' });
  const q = normalize(query);
  if (!q) return all.filter((c) => c.from !== 'known').slice(0, max);
  return all
    .map((c, i) => {
      const byName = matchesName(c.name, q) ? nameRank(c.name, q) : Infinity;
      const byCity = c.city && matchesName(c.city, q) ? nameRank(c.city, q) + 3 : Infinity;
      return { c, i, rank: Math.min(byName, byCity) };
    })
    .filter((x) => Number.isFinite(x.rank))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, max)
    .map((x) => x.c);
}

/** A name someone typed, tidied: spaces collapsed, at most PAST_NAME_MAX, any year taken off. */
export const cleanPastName = (s: string) => seriesName(s.replace(/\s+/g, ' ').trim()).slice(0, PAST_NAME_MAX).trim();

/** A past event read back from storage or a shared video; undefined when it isn't one. */
export function cleanPast(raw: unknown, now: Date = new Date()): PastEvent | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? cleanPastName(o.name) : '';
  const year = o.year;
  if (!name || typeof year !== 'number' || !Number.isInteger(year) || year < FIRST_YEAR || year > now.getFullYear() + 1) return undefined;
  const city = typeof o.city === 'string' && o.city.trim() ? o.city.trim().slice(0, PAST_CITY_MAX) : undefined;
  const seriesId = typeof o.seriesId === 'string' && /^[a-z0-9-]{1,100}$/.test(o.seriesId) ? o.seriesId : undefined;
  return { name, year, ...(city ? { city } : {}), ...(seriesId ? { seriesId } : {}) };
}

/** Your past events from your videos, each once, the most recent year first. */
export function pastEventsOf(memories: readonly { past?: PastEvent }[]): PastEvent[] {
  const byKey = new Map<string, PastEvent>();
  for (const m of memories) if (m.past && !byKey.has(pastKey(m.past))) byKey.set(pastKey(m.past), m.past);
  return [...byKey.values()].sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
}
