/**
 * EDMTrain events -> an Afterglow catalogue file (format v1, mode "add").
 * Pure: the nightly job (scripts/import-edmtrain.ts) fetches and writes, this
 * decides what goes in. Chosen by the owner on 2026-09-30: EDMTrain listings
 * go live automatically each night; festivals curated by hand in
 * catalogue/afterglow.json always win and are never duplicated.
 *
 * EDMTrain lists a multi-day festival as one event per day (same name and
 * venue), so days are grouped back into festivals: consecutive days make one
 * run, a second run within three weeks makes a second weekend. Each artist
 * keeps the day(s) they're listed on. Artists already on Afterglow are
 * matched by name; new ones are added with no sound (shown as New).
 */
export type EdmtrainArtist = { id?: number; name?: string; link?: string; b2bInd?: boolean };
export type EdmtrainVenue = { id?: number; name?: string; location?: string; address?: string; state?: string };
export type EdmtrainEvent = {
  id?: number;
  link?: string;
  name?: string | null;
  date?: string;
  festivalInd?: boolean;
  venue?: EdmtrainVenue;
  artistList?: EdmtrainArtist[];
};

export type CuratedCatalogue = {
  artists: { id: string; name: string }[];
  festivals: { id: string; name: string; location?: string; start?: string; end?: string; weekends?: { start: string; end: string }[] }[];
};

type FileArtist = { id: string; name: string; sound: Record<string, number> };
type LineupEntry = string | { artist: string; days?: string[]; weekend?: number };
type FileFestival = {
  id: string;
  name: string;
  dates: string;
  location: string;
  start: string;
  end: string;
  weekends?: { start: string; end: string }[];
  days: string[];
  lineup: LineupEntry[];
  source: { name: string; url: string };
};
export type ImportedFile = { version: 1; mode: 'add'; artists: FileArtist[]; festivals: FileFestival[]; clips: [] };

/** Only festivals with at least this many acts, starting within this many days, and at most this many in all. */
export const IMPORT_RULES = { minActs: 5, maxDaysAhead: 365, maxFestivals: 150 } as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Letters and digits only, accents dropped, lowercase: for matching names. */
export const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');

/** A safe id: "electric-forest-2027". */
export const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'event';

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const utc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const dayGap = (a: string, b: string) => Math.round((utc(b) - utc(a)) / DAY_MS);
const weekday = (day: string) => WEEKDAYS[new Date(utc(day)).getUTCDay()];
const mon = (day: string) => MONTHS[Number(day.slice(5, 7)) - 1];
const dom = (day: string) => String(Number(day.slice(8, 10)));

/** "Nov 6", "Dec 30 and 31", "Dec 31 and Jan 1", "Nov 6 to 8", "Oct 30 to Nov 1". */
export function datesLabel(start: string, end: string): string {
  if (start === end) return `${mon(start)} ${dom(start)}`;
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const tail = sameMonth ? dom(end) : `${mon(end)} ${dom(end)}`;
  return `${mon(start)} ${dom(start)} ${dayGap(start, end) === 1 ? 'and' : 'to'} ${tail}`;
}

/** The city from a venue's location ("Orlando, FL" -> "orlando"). */
const cityOf = (location: string | undefined) => fold((location ?? '').split(',')[0] ?? '');

/** Whether an imported festival is one the owner curated: dates overlap and it's in the same city (or has the same name). */
function curatedMatch(curated: CuratedCatalogue['festivals'], name: string, location: string, start: string, end: string): boolean {
  const city = cityOf(location.split(',').slice(-2).join(','));
  const cityAlt = cityOf(location);
  return curated.some((c) => {
    const cStart = c.weekends?.[0]?.start ?? c.start;
    const cEnd = c.weekends?.[c.weekends.length - 1]?.end ?? c.end ?? cStart;
    if (!cStart || !cEnd) return fold(c.name) === fold(name);
    const overlaps = start <= cEnd && end >= cStart;
    if (!overlaps) return false;
    const cCity = cityOf((c.location ?? '').split(',').slice(-1)[0]);
    const cCityFirst = cityOf(c.location);
    const sameCity = [cCity, cCityFirst].some((x) => x && (x === city || x === cityAlt));
    const a = fold(c.name).slice(0, 8);
    const b = fold(name).slice(0, 8);
    const similarName = a.length >= 3 && b.length >= 3 && (fold(c.name).includes(b) || fold(name).includes(a));
    return sameCity || similarName;
  });
}

export function edmtrainCatalogue(
  events: EdmtrainEvent[],
  curated: CuratedCatalogue,
  today: string,
  rules: { minActs: number; maxDaysAhead: number; maxFestivals: number } = IMPORT_RULES,
): { file: ImportedFile; skipped: { curated: number; small: number; outOfRange: number } } {
  const skipped = { curated: 0, small: 0, outOfRange: 0 };
  // 1. Festival days, grouped by name and venue.
  const groups = new Map<string, EdmtrainEvent[]>();
  for (const e of events) {
    if (!e.festivalInd || !isDay(e.date) || !e.venue) continue;
    const name = (e.name ?? '').trim() || (e.venue.name ?? '').trim();
    if (!name) continue;
    const key = `${fold(name)}|${e.venue.id ?? fold(e.venue.name ?? '')}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  // 2. Artists: reuse Afterglow's by name, otherwise new (unique) ids.
  const byName = new Map(curated.artists.map((a) => [fold(a.name), a.id]));
  const usedIds = new Set(curated.artists.map((a) => a.id));
  const newArtists = new Map<string, FileArtist>();
  const artistId = (name: string): string => {
    const f = fold(name);
    const known = byName.get(f) ?? newArtists.get(f)?.id;
    if (known) return known;
    let id = slug(name);
    for (let n = 2; usedIds.has(id); n++) id = `${slug(name)}-${n}`;
    usedIds.add(id);
    newArtists.set(f, { id, name: name.trim(), sound: {} });
    return id;
  };

  // 3. Each group -> runs of consecutive days -> one festival (two or more runs within three weeks = weekends).
  const festivals: FileFestival[] = [];
  const usedFestivalIds = new Set(curated.festivals.map((f) => f.id));
  for (const days of groups.values()) {
    const sorted = [...days].sort((a, b) => a.date!.localeCompare(b.date!));
    const dates = [...new Set(sorted.map((e) => e.date!))];
    const runs: string[][] = [];
    for (const d of dates) {
      const last = runs[runs.length - 1];
      if (last && dayGap(last[last.length - 1], d) === 1) last.push(d);
      else runs.push([d]);
    }
    // Runs more than three weeks apart are separate festivals (e.g. next year's edition).
    const editions: string[][][] = [];
    for (const run of runs) {
      const ed = editions[editions.length - 1];
      if (ed && dayGap(ed[ed.length - 1].at(-1)!, run[0]) <= 21) ed.push(run);
      else editions.push([run]);
    }
    for (const edition of editions) {
      const start = edition[0][0];
      const end = edition[edition.length - 1].at(-1)!;
      const ahead = dayGap(today, start);
      if (end < today || ahead > rules.maxDaysAhead) {
        skipped.outOfRange++;
        continue;
      }
      const inEdition = sorted.filter((e) => e.date! >= start && e.date! <= end);
      const first = inEdition[0];
      const name = ((first.name ?? '').trim() || (first.venue?.name ?? '').trim()).slice(0, 80);
      const venue = first.venue!;
      const location = [venue.name, venue.location].filter(Boolean).join(', ').slice(0, 120);
      if (curatedMatch(curated.festivals, name, location, start, end)) {
        skipped.curated++;
        continue;
      }
      // Artists in the order first listed, with the weekday(s) and weekend(s) they play.
      const order: string[] = [];
      const playDays = new Map<string, Set<string>>();
      const playRuns = new Map<string, Set<number>>();
      for (const e of inEdition) {
        const run = edition.findIndex((r) => r.includes(e.date!));
        for (const a of e.artistList ?? []) {
          const n = (a.name ?? '').trim();
          if (!n) continue;
          const id = artistId(n);
          if (!playDays.has(id)) {
            order.push(id);
            playDays.set(id, new Set());
            playRuns.set(id, new Set());
          }
          playDays.get(id)!.add(weekday(e.date!));
          playRuns.get(id)!.add(run);
        }
      }
      if (order.length < rules.minActs) {
        skipped.small++;
        continue;
      }
      const dayNames = [...new Set(edition[0].map(weekday))];
      const multiDay = dayNames.length > 1;
      const twoWeekends = edition.length > 1;
      let id = `${slug(name)}-${start.slice(0, 4)}`;
      for (let n = 2; usedFestivalIds.has(id); n++) id = `${slug(name)}-${start.slice(0, 4)}-${n}`;
      usedFestivalIds.add(id);
      festivals.push({
        id,
        name,
        dates: datesLabel(start, end),
        location,
        start,
        end,
        ...(twoWeekends ? { weekends: edition.map((r) => ({ start: r[0], end: r.at(-1)! })) } : {}),
        days: dayNames,
        lineup: order.map((a) => {
          const d = [...playDays.get(a)!].filter((x) => dayNames.includes(x));
          const runsPlayed = [...playRuns.get(a)!];
          const entry: { artist: string; days?: string[]; weekend?: number } = { artist: a };
          if (multiDay && d.length && d.length < dayNames.length) entry.days = dayNames.filter((x) => d.includes(x));
          if (twoWeekends && runsPlayed.length === 1) entry.weekend = runsPlayed[0] + 1;
          return entry.days || entry.weekend ? entry : a;
        }),
        source: { name: 'EDMTrain', url: first.link && /^https:\/\//.test(first.link) ? first.link : 'https://edmtrain.com' },
      });
    }
  }
  festivals.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
  const kept = festivals.slice(0, rules.maxFestivals);
  // Only the new artists these festivals actually use.
  const used = new Set(kept.flatMap((f) => f.lineup.map((l) => (typeof l === 'string' ? l : l.artist))));
  const artists = [...newArtists.values()].filter((a) => used.has(a.id));
  return { file: { version: 1, mode: 'add', artists, festivals: kept, clips: [] }, skipped };
}
