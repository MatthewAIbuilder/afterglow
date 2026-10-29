import type { Artist, Festival, FestivalLineup, SetTime, Stage } from '../../data/models';
import type { PageSetTimes } from './pageSetTimes';

/**
 * Set times from Clashfinder (clashfinder.com), the fan-made timetables for
 * most festivals, usually up within hours of the official release. Pure: the
 * nightly script (scripts/clashfinder-set-times.ts) fetches, this finds a
 * festival's clashfinder and turns it into the same reading the official-page
 * reader gives, so the same checks (`decide` in pageSetTimes.ts) decide
 * whether it's clearly right before anything is published.
 *
 * Clashfinder's data is CC BY-NC 3.0 ("free for non-commercial use, contact
 * halvin@clashfinder.com for other uses"): the nightly step only publishes
 * once Afterglow has their permission (`CLASHFINDER_PUBLISH` in the script).
 */

/** One clashfinder in `data/events/all.json`. */
export type ClashfinderSummary = {
  name: string;
  desc?: string;
  /** Unix seconds: midnight (UTC) of the first day. */
  startDate?: number;
  numDays?: number;
  numActs?: number;
  edits?: number;
  private?: boolean;
  coreClashfinder?: boolean;
  officialClashfinder?: boolean;
};

/** One clashfinder's timetable, `data/event/<id>.json`. */
export type ClashfinderEvent = {
  id?: string;
  name?: string;
  url?: string;
  timezone?: string;
  locations?: { name?: string; events?: { name?: string; start?: string; end?: string }[] }[];
};

/** Clashfinder's API key: the SHA-256 of the username and private key, as hex. */
export const publicKeyInput = (username: string, privateKey: string) => `${username}${privateKey}`;

const DAY_S = 86_400;
/** A clashfinder this many days either side of the festival's first day can be it (time zones, a warm-up day). */
const START_SLACK_DAYS = 1;
/** Sets starting before this hour belong to the night before (Saturday 02:45 is Friday night's). */
const NIGHT_ENDS_HOUR = 6;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Lowercase letters and digits only, accents dropped. */
export const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/** The words of a festival name that say which festival it is (no year, no "festival"). */
export function nameWords(name: string): string[] {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !/^(19|20)\d\d$/.test(w) && !['festival', 'fest', 'the', 'and', 'of', 'music', 'presents'].includes(w));
}

const dayOf = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);
const dayNumber = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 1000 / DAY_S;

/**
 * The clashfinder for a festival, or undefined: public, starting within a day
 * of the festival, and named like it (every word of the festival's name is in
 * the clashfinder's, or the other way round, or both fold to the same thing).
 * Several fans may make one for the same festival: Clashfinder's own pick
 * (core or official) first, then the one with the most acts, then the most edits.
 */
export function findClashfinder(festival: Pick<Festival, 'name' | 'startDate'>, all: Readonly<Record<string, ClashfinderSummary>>): ClashfinderSummary | undefined {
  if (!festival.startDate) return undefined;
  const want = nameWords(festival.name);
  if (!want.length) return undefined;
  const start = dayNumber(festival.startDate);
  const candidates = Object.values(all).filter((c) => {
    if (!c || c.private || typeof c.startDate !== 'number' || !c.name) return false;
    if (Math.abs(dayNumber(dayOf(c.startDate)) - start) > START_SLACK_DAYS) return false;
    const have = nameWords(c.desc ?? '');
    if (!have.length) return false;
    const a = want.every((w) => have.includes(w));
    const b = have.every((w) => want.includes(w));
    return a || b || fold(want.join('')) === fold(have.join(''));
  });
  const score = (c: ClashfinderSummary) => [c.officialClashfinder ? 1 : 0, c.coreClashfinder ? 1 : 0, c.numActs ?? 0, c.edits ?? 0];
  return candidates.sort((x, y) => {
    const a = score(x);
    const b = score(y);
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
    return x.name.localeCompare(y.name);
  })[0];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/;

/**
 * A clashfinder's timetable as a reading of the festival's set times, for
 * `decide`. Names match artists on Afterglow only (nobody is invented); days
 * are the festival's own (by weekday name, or by order when the festival
 * names its days some other way); a set after midnight stays on its night.
 */
export function readClashfinder(data: ClashfinderEvent, festival: Festival, artists: readonly Artist[]): PageSetTimes | undefined {
  const byName = new Map<string, Artist>();
  for (const a of artists) if (!byName.has(fold(a.name))) byName.set(fold(a.name), a);
  const stages: Stage[] = [...festival.stages];
  const stageId = (name: string): string => {
    const found = stages.find((s) => fold(s.name) === fold(name));
    if (found) return found.id;
    let id = slug(name) || 'stage';
    for (let n = 2; stages.some((s) => s.id === id); n++) id = `${slug(name)}-${n}`;
    stages.push({ id, name });
    return id;
  };
  const first = festival.startDate ? dayNumber(festival.startDate) : undefined;
  const weekdayNames = festival.days.length > 0 && festival.days.every((d) => WEEKDAYS.includes(d));
  /** The festival day a calendar date's night belongs to. */
  const dayName = (date: string): string | undefined => {
    const weekday = WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
    if (!festival.days.length || weekdayNames) return !festival.days.length || festival.days.includes(weekday) ? weekday : undefined;
    if (first === undefined) return undefined;
    return festival.days[dayNumber(date) - first];
  };

  const sets: SetTime[] = [];
  const unknown: string[] = [];
  const strangeDays: string[] = [];
  let read = 0;
  let unread = 0;
  let noDay = 0;
  // Each day's calendar date, to put the days in order.
  const dateOfDay = new Map<string, string>();
  for (const location of data.locations ?? []) {
    const stage = (location?.name ?? '').trim();
    for (const e of location?.events ?? []) {
      const name = (e?.name ?? '').trim();
      const s = TIME.exec(e?.start ?? '');
      const t = TIME.exec(e?.end ?? '');
      if (!name || !s || !t) {
        unread++;
        continue;
      }
      read++;
      // "Bob Moses (Club Set)", "Stavroz (DJ Set)": the act without the note in brackets.
      const artist = byName.get(fold(name)) ?? byName.get(fold(name.replace(/\s*\([^)]*\)\s*$/, '')));
      if (!artist) {
        if (!unknown.includes(name)) unknown.push(name);
        continue;
      }
      // Before dawn: the night before's.
      const date = Number(s[2]) < NIGHT_ENDS_HOUR ? new Date(Date.UTC(Number(s[1].slice(0, 4)), Number(s[1].slice(5, 7)) - 1, Number(s[1].slice(8, 10)) - 1)).toISOString().slice(0, 10) : s[1];
      const day = dayName(date);
      if (!day) {
        noDay++;
        const weekday = WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
        if (!strangeDays.includes(weekday)) strangeDays.push(weekday);
        continue;
      }
      if (!dateOfDay.has(day) || date < dateOfDay.get(day)!) dateOfDay.set(day, date);
      const set: SetTime = { artistId: artist.id, day, stageId: stageId(stage || 'Main Stage'), start: `${s[2]}:${s[3]}`, end: `${t[2]}:${t[3]}` };
      const i = sets.findIndex((x) => x.artistId === set.artistId && x.day === set.day && x.stageId === set.stageId);
      if (i >= 0) sets[i] = set;
      else sets.push(set);
    }
  }
  if (!read) return undefined;
  // The festival's own days in its order; otherwise by date.
  const days = festival.days.length
    ? [...new Set([...festival.days, ...sets.map((s) => s.day)])]
    : [...dateOfDay.keys()].sort((a, b) => dateOfDay.get(a)!.localeCompare(dateOfDay.get(b)!));
  const withSet = new Set(sets.map((s) => s.artistId));
  const coverage = festival.lineup.length ? festival.lineup.filter((id) => withSet.has(id)).length / festival.lineup.length : 0;
  const lineup: FestivalLineup = {
    festivalId: festival.id,
    artistIds: [...new Set([...festival.lineup, ...sets.map((s) => s.artistId)])],
    sets,
    days,
    stages: stages.filter((s) => festival.stages.includes(s) || sets.some((x) => x.stageId === s.id)),
    source: 'page',
  };
  // Clashfinder gives every set a stage and a 24-hour time, so nothing is guessed.
  return { lineup, read, kept: sets.length, unknown, coverage, guessed: 0, noStage: 0, noDay, strangeDays: noDay ? strangeDays : [], unread };
}
