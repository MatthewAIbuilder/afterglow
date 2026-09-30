import type { Festival } from '../../data/models';
import { searchFestivals } from './search';
import { daysUntil } from './when';

/**
 * Keeping long festival lists short. Pure. With a handful of festivals every
 * list shows them all, as before; once the nightly feed brings in many, lists
 * show the festivals you're going to, then a short shelf ("For you": the
 * festivals with the most acts you'd love, or "Coming up": the soonest), and
 * the rest wait behind a search or a "more" row.
 */

/** Up to this many festivals, every list shows them all. */
export const SHOW_ALL_UP_TO = 12;
/** How many festivals a shelf shows. */
export const SHELF_MAX = 8;

export const isMany = (festivals: readonly Festival[]) => festivals.length > SHOW_ALL_UP_TO;

/** Soonest first; undated after; finished last. */
export function whenRank(f: Festival, today: Date): number {
  const until = daysUntil(f, today);
  if (until === undefined) return Number.MAX_SAFE_INTEGER - 1;
  const end = daysUntil({ ...f, startDate: f.endDate ?? f.startDate }, today)!;
  return end < 0 ? Number.MAX_SAFE_INTEGER : until;
}

export const isOver = (f: Festival, today: Date) => whenRank(f, today) === Number.MAX_SAFE_INTEGER;

/** Festivals in date order (stable for ties). */
export function bySoonest(festivals: readonly Festival[], today: Date): Festival[] {
  return festivals
    .map((f, i) => ({ f, i, r: whenRank(f, today) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ f }) => f);
}

/** How many acts on the lineup you'd love. */
export const lovedOn = (f: Festival, loves: (artistId: string) => boolean) => f.lineup.filter(loves).length;

export type Shelf = { title: 'For you' | 'Coming up'; festivals: Festival[] };

/**
 * The short shelf under "Going": festivals you're not going to and that
 * aren't over, with the most acts you'd love first (then soonest), or, when
 * none has any, the soonest.
 */
export function festivalShelf(
  festivals: readonly Festival[],
  going: readonly string[],
  loves: (artistId: string) => boolean,
  today: Date,
  max = SHELF_MAX,
): Shelf {
  const open = bySoonest(
    festivals.filter((f) => !going.includes(f.id) && !isOver(f, today)),
    today,
  );
  const loved = open
    .map((f, i) => ({ f, i, n: lovedOn(f, loves) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map(({ f }) => f);
  return loved.length
    ? { title: 'For you', festivals: loved.slice(0, max) }
    : { title: 'Coming up', festivals: open.slice(0, max) };
}

/**
 * A festival picker's list when there are many: what you searched for, or,
 * with no search, the ones you've picked (kept in view) and then the shelf.
 */
export function pickerList(
  festivals: readonly Festival[],
  picked: readonly string[],
  query: string,
  shelf: readonly Festival[],
): Festival[] {
  if (query.trim()) return searchFestivals([...festivals], query);
  const chosen = festivals.filter((f) => picked.includes(f.id) && !shelf.includes(f));
  return [...chosen, ...shelf];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayMs = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));

/**
 * The festivals to offer when tagging a video, when there are many: the
 * guesses, the one already chosen and the ones you're going to, then the
 * ones on around that date (within `days`), nearest first, up to `max` in
 * all. Anything else is a search away.
 */
export function festivalsAround(
  festivals: readonly Festival[],
  { first, when, days = 30, max = SHOW_ALL_UP_TO }: { first: readonly Festival[]; when?: Date; days?: number; max?: number },
): Festival[] {
  const out: Festival[] = [];
  for (const f of first) if (!out.includes(f)) out.push(f);
  if (when) {
    const t = Date.UTC(when.getFullYear(), when.getMonth(), when.getDate());
    const distance = (f: Festival) => {
      if (!f.startDate) return Infinity;
      const s = dayMs(f.startDate);
      const e = f.endDate ? dayMs(f.endDate) : s;
      return t < s ? (s - t) / DAY_MS : t > e ? (t - e) / DAY_MS : 0;
    };
    festivals
      .map((f, i) => ({ f, i, d: distance(f) }))
      .filter((x) => x.d <= days && !out.includes(x.f))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .forEach(({ f }) => out.push(f));
  }
  return out.slice(0, Math.max(max, first.length));
}
