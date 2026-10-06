import type { Artist, Festival, Show } from '../../data/models';
import { monthTitle } from '../festivals/calendar';
import { runsOf, stillLastNight } from '../festivals/when';
import { months, t, tn } from '../../i18n';
import { localDay, showDateBlock, showTitle, showWhere } from './shows';

/**
 * Where they play: every upcoming date for the artists you follow and love,
 * festivals (from the lineups) and club shows (from the nightly EDMTrain
 * feed) in one date-ordered schedule, grouped by month. Pure.
 */

/** One date in the schedule: a festival run or a club show, with every one of your artists on it. */
export type WhereDate = {
  key: string;
  kind: 'festival' | 'show';
  /** The day, "YYYY-MM-DD": the day your artist plays when the lineup says, else the first day. Undefined for a festival with no dates yet. */
  date?: string;
  /** Your artists playing it, in the order you gave them. */
  artists: Artist[];
  /** The festival's name, or the show's name or venue. */
  title: string;
  /** "Austin, Texas", "Echostage, Washington, DC". */
  where: string;
  /** How far away, in km, when both places are known. */
  km?: number;
  going: boolean;
  near: boolean;
  festival?: Festival;
  show?: Show;
  /** For a festival run over several weekends: which one (1, 2, …). */
  weekend?: number;
};

export type WhereFilter = 'all' | 'near' | 'festivals' | 'shows' | 'going';
export const WHERE_FILTERS: readonly WhereFilter[] = ['all', 'near', 'festivals', 'shows', 'going'];

const dayNum = (iso: string) => Math.round(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000);
const addDays = (iso: string, n: number) => new Date((dayNum(iso) + n) * 86_400_000).toISOString().slice(0, 10);

/** The days of a run an artist plays, from set times or the lineup's days; empty when the lineup doesn't say. */
function artistDayOffsets(f: Festival, artistId: string, runLength: number): number[] {
  const labels = new Set<string>([...(f.sets ?? []).filter((s) => s.artistId === artistId).map((s) => s.day), ...(f.artistDays?.[artistId] ?? [])]);
  // A day label maps to a date only when the festival lists one label per day of the run.
  if (!labels.size || f.days.length !== runLength) return [];
  return [...labels]
    .map((l) => f.days.indexOf(l))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
}

/**
 * The festival dates of one artist still to come: one per run (weekend) they
 * play that isn't over, on their own day when the lineup says. A festival
 * without dates yet gives one undated entry.
 */
function festivalDates(f: Festival, artistId: string, today: Date): { key: string; date?: string; weekend?: number }[] {
  const runs = runsOf(f);
  if (!runs.length) return [{ key: `f:${f.id}` }];
  const todayDay = localDay(today);
  const several = runs.length > 1;
  const only = f.artistWeekends?.[artistId];
  const out: { key: string; date?: string; weekend?: number }[] = [];
  runs.forEach((run, i) => {
    if (several && only && only !== i + 1) return;
    if (run.end < todayDay && !stillLastNight(run.end, today)) return;
    const length = dayNum(run.end) - dayNum(run.start) + 1;
    const offsets = artistDayOffsets(f, artistId, length);
    const days = offsets.length ? offsets.map((o) => addDays(run.start, o)) : [run.start];
    // Their day if it's still to come, else (it's on now) the first day of the run.
    const date = days.find((d) => d >= todayDay) ?? days[0];
    out.push({ key: `f:${f.id}:${i}:${date}`, date, ...(several ? { weekend: i + 1 } : {}) });
  });
  return out;
}

/**
 * The schedule: every upcoming festival date and club show for `artistIds`,
 * one entry per event with all your artists on it, soonest first (festivals
 * you're going to first on the same day), festivals without dates last.
 */
export function whereTheyPlay(
  artistIds: readonly string[],
  opts: {
    artist: (id: string) => Artist | undefined;
    festivalsOf: (id: string) => readonly Festival[];
    showsOf: (id: string, from?: string) => readonly Show[];
    going: readonly string[];
    today: Date;
    distanceTo?: (f: Festival) => number | undefined;
    showKm?: (s: Show) => number | undefined;
    nearKm: number;
  },
): WhereDate[] {
  const byKey = new Map<string, WhereDate>();
  const order = new Map<string, number>();
  const from = localDay(opts.today);
  const add = (key: string, make: () => WhereDate, artist: Artist) => {
    const e = byKey.get(key);
    if (e) {
      if (!e.artists.some((a) => a.id === artist.id)) e.artists.push(artist);
      return;
    }
    order.set(key, order.size);
    byKey.set(key, make());
  };
  const seen = new Set<string>();
  for (const id of artistIds) {
    const artist = opts.artist(id);
    if (!artist || seen.has(id)) continue;
    seen.add(id);
    for (const f of opts.festivalsOf(id)) {
      const km = opts.distanceTo?.(f);
      for (const d of festivalDates(f, id, opts.today)) {
        add(
          d.key,
          () => ({
            key: d.key,
            kind: 'festival',
            ...(d.date ? { date: d.date } : {}),
            artists: [artist],
            title: f.name,
            where: f.location,
            ...(km !== undefined ? { km } : {}),
            going: opts.going.includes(f.id),
            near: km !== undefined && km <= opts.nearKm,
            festival: f,
            ...(d.weekend ? { weekend: d.weekend } : {}),
          }),
          artist,
        );
      }
    }
    for (const s of opts.showsOf(id, from)) {
      if (s.date < from) continue;
      const km = opts.showKm?.(s);
      add(
        `s:${s.id}`,
        () => ({
          key: `s:${s.id}`,
          kind: 'show',
          date: s.date,
          artists: [artist],
          title: showTitle(s),
          where: showWhere(s),
          ...(km !== undefined ? { km } : {}),
          going: false,
          near: km !== undefined && km <= opts.nearKm,
          show: s,
        }),
        artist,
      );
    }
  }
  return [...byKey.values()].sort(
    (a, b) =>
      (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
      Number(b.going) - Number(a.going) ||
      (a.kind === b.kind ? 0 : a.kind === 'festival' ? -1 : 1) ||
      order.get(a.key)! - order.get(b.key)!,
  );
}

/** The dates a filter keeps. */
export function whereFilter(dates: readonly WhereDate[], filter: WhereFilter): WhereDate[] {
  switch (filter) {
    case 'near':
      return dates.filter((d) => d.near);
    case 'festivals':
      return dates.filter((d) => d.kind === 'festival');
    case 'shows':
      return dates.filter((d) => d.kind === 'show');
    case 'going':
      return dates.filter((d) => d.going);
    default:
      return [...dates];
  }
}

/** How many dates each filter keeps, for the chips. */
export function whereCounts(dates: readonly WhereDate[]): Record<WhereFilter, number> {
  return Object.fromEntries(WHERE_FILTERS.map((f) => [f, whereFilter(dates, f).length])) as Record<WhereFilter, number>;
}

export type WhereMonth = { key: string; title: string; dates: WhereDate[] };

/** Dates under month headings: "October", "January 2027" when not this year; festivals without dates under "Date to come". */
export function byMonth(dates: readonly WhereDate[], today: Date): WhereMonth[] {
  const out: WhereMonth[] = [];
  for (const d of dates) {
    const key = d.date ? d.date.slice(0, 7) : 'tba';
    let group = out.find((g) => g.key === key);
    if (!group) {
      const title = d.date ? monthTitle({ year: Number(d.date.slice(0, 4)), month: Number(d.date.slice(5, 7)) - 1 }, today) : t('Date to come');
      group = { key, title, dates: [] };
      out.push(group);
    }
    group.dates.push(d);
  }
  return out;
}

/** "SUBTRONICS", "SUBTRONICS and Levity", "SUBTRONICS, Levity and 2 more". */
export function artistNames(artists: readonly Artist[], most = 2): string {
  const names = artists.map((a) => a.name);
  if (names.length <= most) return names.length === 2 ? t('{a} and {b}', { a: names[0], b: names[1] }) : (names[0] ?? '');
  if (names.length === most + 1) return t('{names} and {last}', { names: names.slice(0, -1).join(', '), last: names[names.length - 1] });
  return t('{names} and {n} more', { names: names.slice(0, most).join(', '), n: names.length - most });
}

/** "Sat 18 Oct" ("Sáb 18 de oct"), for a short line. */
export function shortDate(day: string): string {
  const b = showDateBlock(day);
  return t('{weekday} {day} {month}', { weekday: b.weekday, day: b.day, month: months(true)[Number(day.slice(5, 7)) - 1] });
}

/** Where, in a word or two: the festival's name, or the show's town ("Denver" from "Denver, CO"). */
export function placeWord(d: WhereDate): string {
  if (d.kind === 'festival') return d.title;
  return d.show?.location.split(',')[0]?.trim() || d.title;
}

/** The line under Profile's Your artists: "Next: SUBTRONICS · Sat 18 Oct · Denver". */
export function nextLine(dates: readonly WhereDate[]): string | undefined {
  const d = dates.find((x) => x.date);
  if (!d?.date) return undefined;
  return t('Next: {line}', { line: [d.artists[0]?.name, shortDate(d.date), placeWord(d)].filter(Boolean).join(' · ') });
}

/**
 * The artists this page is about: the ones Profile shows in Your artists (in
 * its order), then everyone else you follow, each once.
 */
export function whereArtists(favourites: readonly string[], followed: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of [...favourites, ...followed]) if (!out.includes(id)) out.push(id);
  return out;
}

/** Each artist's dates in the schedule, for the Your artists list: how many and the next. */
export function datesOf(dates: readonly WhereDate[], artistId: string): WhereDate[] {
  return dates.filter((d) => d.artists.some((a) => a.id === artistId));
}

/** "3 dates", "1 date". */
export const datesCount = (n: number) => tn(n, '{n} date', '{n} dates');
