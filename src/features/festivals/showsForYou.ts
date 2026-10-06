import type { Show } from '../../data/models';
import { isCold, isWarm, type Ratings } from '../taste/ratings';
import { distanceKm, NEAR_KM, type Point } from './near';
import { stateFromText, type Reach } from './reach';
import { matchesName, nameRank, normalize } from './search';

/**
 * Club shows for you: the nightly EDMTrain shows ranked by your live taste.
 * Pure. A show is as good as the best artist on its bill you haven't turned
 * down (a disliked artist never carries a show); artists the engine really
 * knows about (your signals, ratings, spill-over) come before first guesses,
 * and artists you follow get a small lift. Once you've shared where you are,
 * shows within reach come first. Following is a plan: it only orders shows,
 * it never changes a match.
 */

/** The Festivals tab's shelf looks this many days ahead. */
export const SHOWS_DAYS = 90;
/** At most this many shows on the shelf. */
export const SHOWS_FOR_YOU_MAX = 12;
/** A show is "for you" when its best artist is at least this good a match (or you follow or love them). */
export const SHOW_MIN = 0.5;
/** Following an artist lifts their shows by this much (ordering only). */
export const FOLLOW_BOOST = 0.15;
/** "This week" and "This month" reach this many days ahead, today included. */
export const WEEK_DAYS = 7;
export const MONTH_DAYS = 31;

/** What the ranking reads: your live taste, your ratings and who you follow. */
export type ShowTaste = {
  taste: Record<string, number>;
  informed: Record<string, boolean>;
  ratings: Ratings;
  isFollowing: (artistId: string) => boolean;
};

/** One artist on a show's bill, as the ranking sees them. */
export type BillArtist = { id: string; match: number; known: boolean; cold: boolean; followed: boolean };

export type RankedShow = {
  show: Show;
  /** Everyone on the bill, best for you first; anyone you turned down last. */
  bill: BillArtist[];
  /** The artist who carries the show (never one you turned down); none when everyone on it is. */
  best?: BillArtist;
  /** The best artist's live match, 0 to 1 (0 when no one carries it). */
  match: number;
  /** How far away, in km, when both your place and the venue's are known. */
  km?: number;
  /** Within `NEAR_KM` of you. */
  near: boolean;
};

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The day `n` days after `day` ("YYYY-MM-DD"). */
export function addDays(day: string, n: number): string {
  const m = DAY.exec(day);
  if (!m) return day;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n));
  return d.toISOString().slice(0, 10);
}

/** Shows from `today` up to `days` days ahead (today counts as the first). Without `days`, every one from today on. */
export function upcomingShows(shows: readonly Show[], today: string, days?: number): Show[] {
  const last = days === undefined ? undefined : addDays(today, days - 1);
  return shows.filter((s) => s.date >= today && (!last || s.date <= last));
}

/** The same night at the same venue listed twice: keep the one with more of Afterglow's artists. */
export function dedupeShows(shows: readonly Show[]): Show[] {
  const kept = new Map<string, Show>();
  const ids = new Set<string>();
  for (const s of shows) {
    if (ids.has(s.id)) continue;
    ids.add(s.id);
    const key = `${s.date}|${normalize(s.venue)}|${normalize(s.location)}`;
    const had = kept.get(key);
    if (!had || s.artistIds.length > had.artistIds.length) kept.set(key, s);
  }
  // Back in the order given.
  const keep = new Set(kept.values());
  return shows.filter((s) => keep.delete(s));
}

const lift = (a: BillArtist) => a.match + (a.followed ? FOLLOW_BOOST : 0);
/** Known (or followed or loved) before first guesses, then the better match. */
const better = (a: BillArtist, b: BillArtist) => Number(b.known) - Number(a.known) || lift(b) - lift(a);

/** A show's bill, best for you first, and who carries it. */
export function rankShow(show: Show, t: ShowTaste, here?: Point): RankedShow {
  const bill = show.artistIds.map((id): BillArtist => {
    const followed = t.isFollowing(id);
    const rating = t.ratings[id];
    return { id, match: t.taste[id] ?? 0, known: !!t.informed[id] || followed || isWarm(rating), cold: isCold(rating), followed };
  });
  const warm = bill.filter((a) => !a.cold).sort(better);
  const cold = bill.filter((a) => a.cold);
  const best = warm[0];
  const km = here && show.place ? distanceKm(here, show.place) : undefined;
  return { show, bill: [...warm, ...cold], best, match: best?.match ?? 0, km, near: km !== undefined && km <= NEAR_KM };
}

/**
 * Every show, best for you first: near you first (when you've shared where
 * you are), then shows carried by an artist the app really knows you like,
 * then the better match, then the nearer, then the sooner. Shows only
 * artists you turned down are on go last.
 */
export function rankShows(shows: readonly Show[], t: ShowTaste, here?: Point): RankedShow[] {
  return shows
    .map((s) => rankShow(s, t, here))
    .sort(
      (a, b) =>
        Number(!!b.best) - Number(!!a.best) ||
        Number(b.near) - Number(a.near) ||
        (a.best && b.best ? better(a.best, b.best) : 0) ||
        (a.km ?? Infinity) - (b.km ?? Infinity) ||
        a.show.date.localeCompare(b.show.date),
    );
}

/** Good enough to call "for you": a strong enough match the app knows about, or someone you follow or love. */
export function isForYou(r: RankedShow, min = SHOW_MIN): boolean {
  const b = r.best;
  return !!b && (b.followed || (b.known && b.match >= min));
}

/**
 * The Festivals tab's "Shows for you" shelf: upcoming shows (the next
 * `SHOWS_DAYS`), one per night and venue, ranked, at most `SHOWS_FOR_YOU_MAX`.
 * When none is a real match yet (a new taste), the soonest shows instead,
 * near you first, and `forYou` is false.
 */
export function showsForYou(
  shows: readonly Show[],
  t: ShowTaste,
  opts: { today: string; here?: Point; days?: number; max?: number; min?: number },
): { picks: RankedShow[]; forYou: boolean } {
  const max = opts.max ?? SHOWS_FOR_YOU_MAX;
  const ranked = rankShows(dedupeShows(upcomingShows(shows, opts.today, opts.days ?? SHOWS_DAYS)), t, opts.here);
  const picks = ranked.filter((r) => isForYou(r, opts.min));
  if (picks.length) return { picks: picks.slice(0, max), forYou: true };
  const soonest = ranked
    .filter((r) => r.best)
    .sort((a, b) => Number(b.near) - Number(a.near) || a.show.date.localeCompare(b.show.date));
  return { picks: soonest.slice(0, max), forYou: false };
}

export type ShowFilter = 'near' | 'week' | 'month' | 'all';

/** The full list's filters: within reach of you, the next 7 days, the next month, or everything. */
export function filterShows(ranked: readonly RankedShow[], filter: ShowFilter, today: string): RankedShow[] {
  if (filter === 'near') return ranked.filter((r) => r.near);
  if (filter === 'all') return [...ranked];
  const last = addDays(today, (filter === 'week' ? WEEK_DAYS : MONTH_DAYS) - 1);
  return ranked.filter((r) => r.show.date <= last);
}

/**
 * Shows whose artists, name, venue or town match what was typed: an artist's
 * name first (starts with, a word starts with, anywhere), then the show's
 * name or venue, then its town; sooner first within each. Nothing for an
 * empty search.
 */
export function searchShows(shows: readonly Show[], query: string, nameOf: (artistId: string) => string | undefined, max = Infinity): Show[] {
  if (!query.trim()) return [];
  const q = normalize(query);
  const rank = (s: Show) => {
    const names = s.artistIds.flatMap((id) => nameOf(id) ?? []).filter((n) => matchesName(n, query));
    if (names.length) return Math.min(...names.map((n) => nameRank(n, q)));
    const title = [s.name, s.venue].filter((x): x is string => !!x).filter((x) => matchesName(x, query));
    if (title.length) return 3 + Math.min(...title.map((x) => nameRank(x, q)));
    return s.location && matchesName(s.location, query) ? 6 : -1;
  };
  return shows
    .map((s, i) => ({ s, i, r: rank(s) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.s.date.localeCompare(b.s.date) || a.i - b.i)
    .slice(0, max)
    .map((x) => x.s);
}

/** Shows within the festival calendar's reach: near you (when you've shared where you are), in a state, or everywhere. */
export function showsInReach(ranked: readonly RankedShow[], reach: Reach, located: boolean): RankedShow[] {
  if (reach.kind === 'all' || (reach.kind === 'near' && !located)) return [...ranked];
  if (reach.kind === 'state') return ranked.filter((r) => stateFromText(r.show.location) === reach.code);
  return ranked.filter((r) => r.km !== undefined && r.km <= reach.km);
}

/** Shows by day ("YYYY-MM-DD"), each day in the order given. */
export function showsByDay(ranked: readonly RankedShow[]): Map<string, RankedShow[]> {
  const out = new Map<string, RankedShow[]>();
  for (const r of ranked) out.set(r.show.date, [...(out.get(r.show.date) ?? []), r]);
  return out;
}

/** "92% match" for the best artist on the bill; nothing when no one carries the show. */
export const matchLabel = (r: RankedShow) => (r.best ? `${Math.round(r.match * 100)}%` : undefined);
