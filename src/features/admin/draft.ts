import type { Artist, Festival } from '../../data/models';
import { fold, slug } from '../../data/import/edmtrain';
import { type ReadList, withEnds } from './setlist';

/**
 * Turning a read set list into a catalogue update (the same file format as
 * catalogue/afterglow.json) for one festival, pure. Names are matched to
 * artists already on Afterglow by spelling (case, accents and punctuation
 * ignored); anyone else is added as a new artist. For a festival already on
 * Afterglow, everything it has is kept and only what the text adds changes.
 */

export type DraftTarget =
  | { kind: 'existing'; festival: Festival }
  | { kind: 'new'; name: string; start?: string; end?: string; location?: string };

/** Add the text's acts to the lineup, or make the lineup exactly what the text lists. */
export type LineupMode = 'add' | 'replace';

export type Draft = {
  festivalId: string;
  festivalName: string;
  /** The catalogue update, ready to publish. */
  file: CatalogFileJson;
  matched: string[];
  added: string[];
  sets: number;
  days: string[];
  stages: string[];
  /** Plain notes for checking: guessed AM/PM, guessed ends, sets with no day. */
  notes: string[];
};

type FileFestival = Record<string, unknown>;
export type CatalogFileJson = { version: 1; mode: 'add'; updated: string; artists: { id: string; name: string; sound: Record<string, number> }[]; festivals: FileFestival[]; clips: [] };

/** A festival written back in the catalogue file's words, so publishing it keeps everything it had. */
export function festivalToFile(f: Festival): FileFestival {
  const lineup = f.lineup.map((id) => {
    const note = f.notes?.[id];
    const days = f.artistDays?.[id];
    const weekend = f.artistWeekends?.[id];
    if (!note && !days?.length && !weekend) return id;
    return { artist: id, ...(note ? { note } : {}), ...(days?.length ? { days } : {}), ...(weekend ? { weekend } : {}) };
  });
  return {
    id: f.id,
    name: f.name,
    dates: f.dates,
    location: f.location,
    ...(f.startDate ? { start: f.startDate } : {}),
    ...(f.endDate ? { end: f.endDate } : {}),
    ...(f.weekends ? { weekends: f.weekends } : {}),
    ...(f.place ? { place: f.place } : {}),
    ...(f.links?.tickets ? { tickets: f.links.tickets } : {}),
    ...(f.links?.website ? { website: f.links.website } : {}),
    ...(f.source ? { source: f.source } : {}),
    ...(f.posterImageUrl && !f.posterFrom ? { poster: f.posterImageUrl } : {}),
    lineup,
    days: f.days,
    stages: f.stages,
    ...(f.sets?.length ? { sets: f.sets.map((s) => ({ artist: s.artistId, day: s.day, stage: s.stageId, start: s.start, end: s.end })) } : {}),
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Dec 4 to 6", "Dec 31 to Jan 1", "Dec 4". */
export function datesText(start?: string, end?: string): string {
  if (!start) return 'Dates to come';
  const [ys, ms, ds] = start.split('-').map(Number);
  if (!end || end === start) return `${MONTHS[ms - 1]} ${ds}`;
  const [, me, de] = end.split('-').map(Number);
  void ys;
  return me === ms ? `${MONTHS[ms - 1]} ${ds} to ${de}` : `${MONTHS[ms - 1]} ${ds} to ${MONTHS[me - 1]} ${de}`;
}

/** Each weekday name from start to end, in order ("Friday", "Saturday", "Sunday"). */
export function weekdaysBetween(start?: string, end?: string): string[] {
  if (!start) return [];
  const [y, m, d] = start.split('-').map(Number);
  const out: string[] = [];
  const last = end ?? start;
  for (let i = 0; i < 14; i++) {
    const day = new Date(y, m - 1, d + i);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    if (key > last) break;
    out.push(WEEKDAYS[day.getDay()]);
  }
  return out;
}

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

export function buildDraft(
  read: ReadList,
  target: DraftTarget,
  artists: readonly Artist[],
  opts: { lineup?: LineupMode; today: string; festivalIds?: readonly string[] },
): Draft {
  const notes: string[] = [];
  const byName = new Map(artists.map((a) => [fold(a.name), a]));
  const taken = new Set(artists.map((a) => a.id));
  const newArtists: { id: string; name: string; sound: Record<string, number> }[] = [];
  const matched: string[] = [];
  const added: string[] = [];
  const idOf = new Map<string, string>();
  const artistId = (name: string) => {
    const key = fold(name);
    const known = idOf.get(key);
    if (known) return known;
    const found = byName.get(key);
    if (found) {
      matched.push(found.name);
      idOf.set(key, found.id);
      return found.id;
    }
    let id = slug(name);
    for (let n = 2; taken.has(id); n++) id = `${slug(name)}-${n}`;
    taken.add(id);
    newArtists.push({ id, name, sound: {} });
    added.push(name);
    idOf.set(key, id);
    return id;
  };

  const base: Festival =
    target.kind === 'existing'
      ? target.festival
      : {
          id: (() => {
            const want = slug(`${target.name}${target.start ? ` ${target.start.slice(0, 4)}` : ''}`);
            const used = new Set(opts.festivalIds ?? []);
            let id = want;
            for (let n = 2; used.has(id); n++) id = `${want}-${n}`;
            return id;
          })(),
          name: target.name.trim(),
          dates: datesText(target.start, target.end),
          location: target.location?.trim() ?? '',
          lineup: [],
          days: [],
          stages: [],
          ...(target.start ? { startDate: target.start } : {}),
          ...(target.end ? { endDate: target.end } : target.start ? { endDate: target.start } : {}),
        };

  const actIds = read.acts.map((a) => artistId(a.name));
  const mode = opts.lineup ?? (target.kind === 'new' ? 'replace' : 'add');
  const lineup = mode === 'replace' ? uniq(actIds) : uniq([...base.lineup, ...actIds]);

  // Days: the festival's own, then any new ones the text names; a new festival's from its dates when the text names none.
  const days = uniq([...base.days, ...read.days]);
  if (!days.length && target.kind === 'new') days.push(...weekdaysBetween(target.start, target.end));

  // Stages: matched to the festival's by name, new ones added.
  const stages = [...base.stages];
  const stageId = (name: string | undefined) => {
    const label = name ?? 'Main Stage';
    const found = stages.find((s) => fold(s.name) === fold(label));
    if (found) return found.id;
    let id = slug(label);
    for (let n = 2; stages.some((s) => s.id === id); n++) id = `${slug(label)}-${n}`;
    stages.push({ id, name: label });
    return id;
  };

  const artistDays: Record<string, string[]> = { ...(base.artistDays ?? {}) };
  for (const a of read.acts) if (a.days.length) artistDays[artistId(a.name)] = a.days;

  const ended = withEnds(read.sets);
  // Replacing the lineup keeps only the old set times of acts still on it.
  const sets = mode === 'replace' ? (base.sets ?? []).filter((x) => lineup.includes(x.artistId)) : [...(base.sets ?? [])];
  let noDay = 0;
  for (const s of ended) {
    const day = s.day ?? (days.length === 1 ? days[0] : undefined);
    if (!day) {
      noDay++;
      continue;
    }
    const id = artistId(s.name);
    const stage = stageId(s.stage);
    // A set read again (the same act that day) replaces the old one.
    const i = sets.findIndex((x) => x.artistId === id && x.day === day);
    const set = { artistId: id, day, stageId: stage, start: s.start, end: s.end };
    if (i >= 0) sets[i] = set;
    else sets.push(set);
  }
  const guessedTimes = ended.filter((s) => s.guessed).length;
  const guessedEnds = ended.filter((s) => s.endGuessed).length;
  if (guessedTimes) notes.push(`${guessedTimes} ${guessedTimes === 1 ? 'time has' : 'times have'} no AM or PM, so it was worked out from the sets around ${guessedTimes === 1 ? 'it' : 'them'}.`);
  if (guessedEnds) notes.push(`${guessedEnds} ${guessedEnds === 1 ? 'set has' : 'sets have'} no end time: until the next set on that stage, or an hour.`);
  if (noDay) notes.push(`${noDay} ${noDay === 1 ? 'set was' : 'sets were'} left out: no day heading above ${noDay === 1 ? 'it' : 'them'}. Add a line like "Friday" before the times.`);
  if (read.unread.length) notes.push(`${read.unread.length} ${read.unread.length === 1 ? 'line' : 'lines'} couldn’t be read.`);

  // Sets for acts not on the lineup join it (a timetable names everyone playing).
  for (const x of sets) if (!lineup.includes(x.artistId)) lineup.push(x.artistId);
  const keptDays = Object.fromEntries(Object.entries(artistDays).filter(([id]) => lineup.includes(id)));
  const festival: Festival = {
    ...base,
    lineup,
    days,
    stages,
    ...(Object.keys(keptDays).length ? { artistDays: keptDays } : {}),
    ...(sets.length ? { sets: sets.filter((x) => lineup.includes(x.artistId)) } : {}),
  };

  return {
    festivalId: festival.id,
    festivalName: festival.name,
    file: { version: 1, mode: 'add', updated: opts.today, artists: newArtists, festivals: [festivalToFile(festival)], clips: [] },
    matched: uniq(matched),
    added,
    sets: ended.length - noDay,
    days,
    stages: festival.stages.map((s) => s.name),
    notes,
  };
}

/** "48 acts (44 already on Afterglow, 4 new) · 52 set times over 3 days". */
export function draftLine(d: Draft): string {
  const acts = d.matched.length + d.added.length;
  const parts = [`${acts} ${acts === 1 ? 'act' : 'acts'} (${d.matched.length} already on Afterglow, ${d.added.length} new)`];
  if (d.sets) parts.push(`${d.sets} set ${d.sets === 1 ? 'time' : 'times'}${d.days.length ? ` over ${d.days.length} ${d.days.length === 1 ? 'day' : 'days'}` : ''}`);
  return parts.join(' · ');
}
