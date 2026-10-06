import type { Festival } from '../../data/models';
import type { Notice } from './inbox';
import { countdown } from '../festivals/when';
import { t } from '../../i18n';

/**
 * Lineup news: when a catalogue update adds artists to a festival (or a whole
 * new festival arrives), the bell says so for the artists you'd love. Worked
 * out on the phone by remembering every act seen on each lineup. Pure.
 *
 * Every act ever seen is remembered (never forgotten when it drops off), so
 * a catalogue that briefly shows an older lineup and then the newer one again
 * never announces the same act twice. The first time the app sees any
 * lineups it just takes note: nothing is "new" to someone who just arrived.
 */
export type LineupNewsItem = {
  festivalId: string;
  /** Acts added, in lineup order (a new festival: its whole lineup). */
  artists: string[];
  /** A festival that wasn't on Afterglow before. */
  newFestival?: boolean;
  /** When it was noticed (ms). */
  at: number;
};

export type LineupMemory = {
  /** Festival id -> every act ever seen on its lineup. */
  seen: Record<string, string[]>;
  /** What was added lately, newest last. */
  news: LineupNewsItem[];
};

export const EMPTY_LINEUP_MEMORY: LineupMemory = { seen: {}, news: [] };

/** News is kept this long. */
export const NEWS_DAYS = 30;
/** At most this many news items are kept. */
export const NEWS_MAX = 200;
/** An act counts as just added on the lineup for this long. */
export const JUST_ADDED_DAYS = 14;
/** More new festivals than this arriving together (the nightly feed) become one notice. */
export const NEW_FESTIVALS_GROUP_AT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The memory after seeing these festivals now. Returns the same object when
 * nothing changed (so nothing needs saving).
 */
export function trackLineups(memory: LineupMemory, festivals: Festival[], now: number): LineupMemory {
  const firstLook = Object.keys(memory.seen).length === 0;
  let seen = memory.seen;
  const added: LineupNewsItem[] = [];
  for (const f of festivals) {
    const before = memory.seen[f.id];
    if (!before) {
      seen = { ...seen, [f.id]: [...f.lineup] };
      if (!firstLook && f.lineup.length) added.push({ festivalId: f.id, artists: [...f.lineup], newFestival: true, at: now });
      continue;
    }
    const had = new Set(before);
    const fresh = f.lineup.filter((a) => !had.has(a));
    if (!fresh.length) continue;
    seen = { ...seen, [f.id]: [...before, ...fresh] };
    added.push({ festivalId: f.id, artists: fresh, at: now });
  }
  const kept = memory.news.filter((n) => now - n.at < NEWS_DAYS * DAY_MS);
  if (seen === memory.seen && !added.length && kept.length === memory.news.length) return memory;
  return { seen, news: [...kept, ...added].slice(-NEWS_MAX) };
}

/** Acts added to this festival's lineup in the last JUST_ADDED_DAYS (not a new festival's whole lineup). */
export function justAdded(memory: LineupMemory, festivalId: string, now: number): ReadonlySet<string> {
  const out = new Set<string>();
  for (const n of memory.news) if (n.festivalId === festivalId && !n.newFestival && now - n.at < JUST_ADDED_DAYS * DAY_MS) n.artists.forEach((a) => out.add(a));
  return out;
}

const names = (list: string[]) =>
  list.length === 1 ? list[0] : list.length === 2 ? t('{a} and {b}', { a: list[0], b: list[1] }) : t('{a}, {b} and {n} more you’d love', { a: list[0], b: list[1], n: list.length - 2 });

/**
 * The bell's lineup news: for each item, the added acts you'd love (and who
 * still play the festival as it is for you), newest first. Festivals that are
 * over, or news with no one you'd love, say nothing.
 */
export function lineupNotices(
  news: LineupNewsItem[],
  opts: { festivals: Festival[]; loves: (artistId: string) => boolean; nameOf: (artistId: string) => string | undefined; going: ReadonlySet<string>; today: Date },
): Notice[] {
  const byId = new Map(opts.festivals.map((f) => [f.id, f]));
  // New festivals that arrived together with acts you'd love: one notice when there are many.
  const newAt = new Map<number, { festival: Festival; loved: string[] }[]>();
  for (const n of news) {
    const f = byId.get(n.festivalId);
    if (!n.newFestival || !f || countdown(f, opts.today) === t('Over')) continue;
    const onLineup = new Set(f.lineup);
    const loved = n.artists.filter((a) => onLineup.has(a) && opts.loves(a)).map(opts.nameOf).filter((x): x is string => !!x);
    if (loved.length) newAt.set(n.at, [...(newAt.get(n.at) ?? []), { festival: f, loved }]);
  }
  const grouped = new Set([...newAt].filter(([, fs]) => fs.length > NEW_FESTIVALS_GROUP_AT).map(([at]) => at));
  const out: Notice[] = [];
  const done = new Set<number>();
  for (const n of [...news].reverse()) {
    if (n.newFestival && grouped.has(n.at)) {
      if (done.has(n.at)) continue;
      done.add(n.at);
      const fs = newAt.get(n.at)!;
      const acts = [...new Set(fs.flatMap((x) => x.loved))];
      out.push({
        id: `lineup:new:${n.at}`,
        at: n.at,
        kind: 'lineup',
        href: '/festivals',
        title: t('{n} new festivals with artists you’d love', { n: fs.length }),
        body: acts.length === 1 ? t('{names} plays. See them on Festivals.', { names: names(acts) }) : t('{names} play. See them on Festivals.', { names: names(acts) }),
      });
      continue;
    }
    const f = byId.get(n.festivalId);
    if (!f || countdown(f, opts.today) === t('Over')) continue;
    const onLineup = new Set(f.lineup);
    const loved = n.artists.filter((a) => onLineup.has(a) && opts.loves(a)).map(opts.nameOf).filter((x): x is string => !!x);
    if (!loved.length) continue;
    const going = opts.going.has(f.id);
    out.push(
      n.newFestival
        ? {
            id: `lineup:${f.id}:${n.at}`,
            at: n.at,
            kind: 'lineup',
            festivalId: f.id,
            href: `/festival/${f.id}`,
            title: t('{festival} is on Afterglow', { festival: f.name }),
            body: loved.length === 1 ? t('{names} plays. See the lineup.', { names: names(loved) }) : t('{names} play. See the lineup.', { names: names(loved) }),
          }
        : {
            id: `lineup:${f.id}:${n.at}`,
            at: n.at,
            kind: 'lineup',
            festivalId: f.id,
            href: `/festival/${f.id}`,
            title:
              loved.length === 1
                ? t('{names} was added to {festival}', { names: names(loved), festival: f.name })
                : t('{names} were added to {festival}', { names: names(loved), festival: f.name }),
            body: going ? t('See how it changes your plan.') : t('See the full lineup.'),
          },
    );
  }
  return out;
}

/** A saved memory read back safely: anything malformed is dropped. */
export function cleanLineupMemory(raw: unknown): LineupMemory {
  if (!raw || typeof raw !== 'object') return EMPTY_LINEUP_MEMORY;
  const o = raw as { seen?: unknown; news?: unknown };
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const seen: Record<string, string[]> = {};
  if (o.seen && typeof o.seen === 'object') for (const [k, v] of Object.entries(o.seen)) seen[k] = strs(v);
  const news = Array.isArray(o.news)
    ? o.news.flatMap((n): LineupNewsItem[] => {
        if (!n || typeof n !== 'object') return [];
        const x = n as Record<string, unknown>;
        if (typeof x.festivalId !== 'string' || typeof x.at !== 'number') return [];
        return [{ festivalId: x.festivalId, artists: strs(x.artists), at: x.at, ...(x.newFestival === true ? { newFestival: true } : {}) }];
      })
    : [];
  return { seen, news: news.slice(-NEWS_MAX) };
}
