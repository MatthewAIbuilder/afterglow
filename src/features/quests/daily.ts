/**
 * Daily quests: three small things to do each day (one about watching, one
 * about your taste, one about planning), a bigger one each week, a streak
 * for days you finish all three, and a glow level that grows with
 * everything you do: daily and weekly quests, side quests and milestones.
 *
 * Pure. Progress is "how far you've come since the day began": the app keeps
 * a snapshot of a few counts (likes, ratings, …) taken the first time it
 * sees a new day, and counts what's changed since, plus a few things it
 * counts as they happen (opening the festival map, sharing). Days turn over
 * at 4 AM, so a late night still counts as the night it was.
 */

export type CountKey = 'likes' | 'saves' | 'through' | 'rated' | 'warm' | 'follows' | 'stars';
export const COUNT_KEYS: readonly CountKey[] = ['likes', 'saves', 'through', 'rated', 'warm', 'follows', 'stars'];

/**
 * What quests count, as the ids of each kind of thing (clips you like, save
 * or watched to the end; artists you rated, love or like, follow; sets you
 * starred as "festival:artist"). Progress is the ids that weren't there when
 * the day began, so taking a like back and giving it again never counts twice.
 */
export type Counters = Record<CountKey, readonly string[]>;
export const NO_COUNTS: Counters = { likes: [], saves: [], through: [], rated: [], warm: [], follows: [], stars: [] };

/** How many of `now` weren't in `base`. */
export const added = (now: readonly string[], base: readonly string[]) => {
  const was = new Set(base);
  return now.filter((id) => !was.has(id)).length;
};

/** Things counted as they happen. */
export type QuestEvent = 'map' | 'thisorthat' | 'share' | 'bubble';
export const QUEST_EVENTS: readonly QuestEvent[] = ['map', 'thisorthat', 'share', 'bubble'];

export type DailyQuestId =
  | 'watch'
  | 'through'
  | 'like'
  | 'save'
  | 'sounds'
  | 'rate'
  | 'warm'
  | 'thisorthat'
  | 'bubble'
  | 'follow'
  | 'stars'
  | 'map'
  | 'share';

export type WeeklyQuestId = 'w-watch' | 'w-rate' | 'w-days' | 'w-sounds' | 'w-love';

/** Where a quest is done: watching, your taste, or planning. One of each a day. */
export type QuestLane = 'watch' | 'taste' | 'plan';

/** Where tapping a quest takes you. `festival` = your next festival's page (or Festivals). */
export type QuestGo = '/' | '/sound' | '/pick-artists' | '/this-or-that' | '/search' | '/festival-map' | 'festival' | '/discover-focus';

export type DailySpec = { id: DailyQuestId; lane: QuestLane; title: string; how: string; target: number; glow: number; go?: QuestGo };
export type WeeklySpec = { id: WeeklyQuestId; title: string; how: string; target: number; glow: number; go?: QuestGo };

export const DAILY: readonly DailySpec[] = [
  { id: 'watch', lane: 'watch', title: 'Warm up', how: 'Watch 5 live sets', target: 5, glow: 20, go: '/' },
  { id: 'through', lane: 'watch', title: 'All the way', how: 'Watch 2 clips to the end', target: 2, glow: 25, go: '/' },
  { id: 'like', lane: 'watch', title: 'Feel it', how: 'Double-tap to like 3 clips', target: 3, glow: 15, go: '/' },
  { id: 'save', lane: 'watch', title: 'Keeper', how: 'Save a set to watch again', target: 1, glow: 15, go: '/' },
  { id: 'sounds', lane: 'watch', title: 'Genre hopper', how: 'Watch sets from 3 different sounds', target: 3, glow: 25, go: '/discover-focus' },
  { id: 'rate', lane: 'taste', title: 'Taste test', how: 'Rate 5 artists', target: 5, glow: 25, go: '/pick-artists' },
  { id: 'warm', lane: 'taste', title: 'New love', how: 'Find an artist you love or like', target: 1, glow: 20, go: '/this-or-that' },
  { id: 'thisorthat', lane: 'taste', title: 'Head to head', how: 'Play This or that to the end', target: 1, glow: 20, go: '/this-or-that' },
  { id: 'bubble', lane: 'taste', title: 'Stargazer', how: 'Open 3 artists on My Sound', target: 3, glow: 15, go: '/sound' },
  { id: 'follow', lane: 'plan', title: 'Fan club', how: 'Follow an artist', target: 1, glow: 15, go: '/search' },
  { id: 'stars', lane: 'plan', title: 'Must-see', how: 'Star 2 sets you won’t miss', target: 2, glow: 20, go: 'festival' },
  { id: 'map', lane: 'plan', title: 'Explorer', how: 'Look around the festival map', target: 1, glow: 10, go: '/festival-map' },
  { id: 'share', lane: 'plan', title: 'Spread the glow', how: 'Share a set, a plan or a festival', target: 1, glow: 15 },
];

export const WEEKLY: readonly WeeklySpec[] = [
  { id: 'w-watch', title: 'Binge week', how: 'Watch 30 different sets this week', target: 30, glow: 150, go: '/' },
  { id: 'w-rate', title: 'Deep dig', how: 'Rate 20 artists this week', target: 20, glow: 150, go: '/pick-artists' },
  { id: 'w-days', title: 'Regular', how: 'Finish your daily quests on 4 days', target: 4, glow: 150 },
  { id: 'w-sounds', title: 'World tour', how: 'Watch sets from 5 different sounds', target: 5, glow: 150, go: '/discover-focus' },
  { id: 'w-love', title: 'Heart eyes', how: 'Find 5 artists you love or like', target: 5, glow: 150, go: '/this-or-that' },
];

/** Finishing all three of a day's quests earns this much more. */
export const ALL_DONE_BONUS = 40;
/** Glow for each side quest done and each milestone earned. */
export const SIDE_QUEST_GLOW = 150;
export const MILESTONE_GLOW = 75;
/** Days turn over at this hour. */
export const DAY_TURNS_AT = 4;

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The quest day a moment belongs to ("2026-10-03"); days run 4 AM to 4 AM. */
export function questDay(t: number): string {
  const d = new Date(t - DAY_TURNS_AT * 3_600_000);
  return dateKey(d);
}

/** When a quest day began, in ms. */
export function dayStart(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, DAY_TURNS_AT).getTime();
}

/** The quest week a moment belongs to: the Monday it started on. */
export function questWeek(t: number): string {
  const day = questDay(t);
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const back = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - back);
  return dateKey(date);
}

/** The day before (or after, with a negative step). */
export function shiftDay(day: string, by: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - by));
}

/** A small stable hash, so the same day always draws the same quests. */
export function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Today's three quests: one per lane, drawn by the day so everyone gets a
 * different mix each day but the same day never changes. Quests you can't
 * do right now (starring sets with no festival planned) are skipped; a lane
 * with nothing doable falls back to another lane.
 */
export function dailyPicks(day: string, can: (id: DailyQuestId) => boolean = () => true): DailySpec[] {
  const order = [...DAILY].filter((q) => can(q.id)).sort((a, b) => hashOf(`${day}:${a.id}`) - hashOf(`${day}:${b.id}`));
  const picks: DailySpec[] = [];
  for (const lane of ['watch', 'taste', 'plan'] as const) {
    const q = order.find((x) => x.lane === lane && !picks.includes(x));
    if (q) picks.push(q);
  }
  for (const q of order) if (picks.length < 3 && !picks.includes(q)) picks.push(q);
  return picks;
}

/** What's possible right now: starring sets needs a festival you're going to; This or that needs enough sets. */
export type QuestAbility = { planning: boolean; enoughSets: boolean };
export const canDo =
  (a: QuestAbility) =>
  (id: DailyQuestId): boolean =>
    id === 'stars' ? a.planning : id === 'thisorthat' ? a.enoughSets : true;

/** The day's picks: as fixed in the book, else drawn now. */
export function picksFor(book: Pick<QuestBook, 'day' | 'picks'>, can: (id: DailyQuestId) => boolean): DailySpec[] {
  if (book.picks) return book.picks.map((id) => DAILY.find((q) => q.id === id)!).filter(Boolean);
  return dailyPicks(book.day, can);
}

/** This week's big quest, drawn by the week. */
export function weeklyPick(week: string): WeeklySpec {
  return WEEKLY[hashOf(`week:${week}`) % WEEKLY.length];
}

/** What the phone knows right now that quests count from. */
export type QuestSnapshot = {
  counts: Counters;
  /** Clip id -> when it was last on screen. */
  seen: Readonly<Record<string, number>>;
  /** A clip's sound (its artist's strongest), when it has one. */
  soundOf: (clipId: string) => string | undefined;
};

/** Sets on screen since a moment, and how many sounds they span. */
export function watchedSince(snap: QuestSnapshot, since: number): { sets: number; sounds: number } {
  const ids = Object.entries(snap.seen)
    .filter(([, t]) => t >= since)
    .map(([id]) => id);
  const sounds = new Set(ids.map(snap.soundOf).filter((s): s is string => !!s));
  return { sets: ids.length, sounds: sounds.size };
}

/** How far along a daily quest is (capped at its target). */
export function dailyCurrent(spec: DailySpec, snap: QuestSnapshot, base: Counters, events: Partial<Record<QuestEvent, number>>, since: number): number {
  const d = (k: CountKey) => added(snap.counts[k], base[k]);
  const watched = spec.id === 'watch' || spec.id === 'sounds' ? watchedSince(snap, since) : undefined;
  const n = {
    watch: () => watched!.sets,
    sounds: () => watched!.sounds,
    through: () => d('through'),
    like: () => d('likes'),
    save: () => d('saves'),
    rate: () => d('rated'),
    warm: () => d('warm'),
    follow: () => d('follows'),
    stars: () => d('stars'),
    thisorthat: () => events.thisorthat ?? 0,
    bubble: () => events.bubble ?? 0,
    map: () => events.map ?? 0,
    share: () => events.share ?? 0,
  }[spec.id]();
  return Math.min(spec.target, n);
}

/** How far along this week's quest is. `daysDone` = days this week you finished all three. */
export function weeklyCurrent(spec: WeeklySpec, snap: QuestSnapshot, base: Counters, since: number, daysDone: number): number {
  const watched = watchedSince(snap, since);
  const n = {
    'w-watch': watched.sets,
    'w-sounds': watched.sounds,
    'w-rate': added(snap.counts.rated, base.rated),
    'w-love': added(snap.counts.warm, base.warm),
    'w-days': daysDone,
  }[spec.id];
  return Math.min(spec.target, n);
}

/** What's kept on the phone. */
export type QuestBook = {
  day: string;
  /** The counts when the day began. */
  base: Counters;
  /** Things counted today. */
  events: Partial<Record<QuestEvent, number>>;
  /** Today's three, fixed when the day began (so planning a festival mid-day never swaps one). */
  picks?: DailyQuestId[];
  /** Quests done today. */
  done: DailyQuestId[];
  week: string;
  weekBase: Counters;
  weekDone: boolean;
  /** Days you finished all three (the last `HISTORY_DAYS`). */
  lit: string[];
  /** Every bit of glow from daily and weekly quests, ever. */
  glow: number;
};

export const HISTORY_DAYS = 60;
/** At most this many ids of each kind in a snapshot. */
export const IDS_MAX = 2000;

/** A fresh book, or the day (and week) turned over: new snapshots, the history kept. */
export function turnOver(book: QuestBook | undefined, now: number, counts: Counters): QuestBook {
  const day = questDay(now);
  const week = questWeek(now);
  if (!book) return { day, base: counts, events: {}, done: [], week, weekBase: counts, weekDone: false, lit: [], glow: 0 };
  let next = book;
  if (book.day !== day) next = { ...next, day, base: counts, events: {}, done: [], picks: undefined };
  if (book.week !== week) next = { ...next, week, weekBase: counts, weekDone: false };
  if (next !== book) next = { ...next, lit: next.lit.filter((d) => d >= shiftDay(day, HISTORY_DAYS)) };
  return next;
}

/** Counts something that just happened, today. */
export function withEvent(book: QuestBook, event: QuestEvent): QuestBook {
  return { ...book, events: { ...book.events, [event]: (book.events[event] ?? 0) + 1 } };
}

export type Finished = { kind: 'daily'; spec: DailySpec } | { kind: 'all'; glow: number } | { kind: 'weekly'; spec: WeeklySpec };

/**
 * Marks whatever just got finished, adding its glow. Returns the same book
 * when nothing changed, and what was finished (to celebrate).
 */
export function settleQuests(
  book: QuestBook,
  picks: readonly DailySpec[],
  snap: QuestSnapshot,
): { book: QuestBook; finished: Finished[] } {
  const since = dayStart(book.day);
  const finished: Finished[] = [];
  let next = book;
  for (const spec of picks) {
    if (next.done.includes(spec.id)) continue;
    if (dailyCurrent(spec, snap, next.base, next.events, since) >= spec.target) {
      next = { ...next, done: [...next.done, spec.id], glow: next.glow + spec.glow };
      finished.push({ kind: 'daily', spec });
    }
  }
  if (picks.length && picks.every((p) => next.done.includes(p.id)) && !next.lit.includes(next.day)) {
    next = { ...next, lit: [...next.lit, next.day].sort(), glow: next.glow + ALL_DONE_BONUS };
    finished.push({ kind: 'all', glow: ALL_DONE_BONUS });
  }
  const weekly = weeklyPick(next.week);
  if (!next.weekDone && weeklyCurrent(weekly, snap, next.weekBase, dayStart(next.week), daysLitInWeek(next)) >= weekly.target) {
    next = { ...next, weekDone: true, glow: next.glow + weekly.glow };
    finished.push({ kind: 'weekly', spec: weekly });
  }
  return { book: next, finished };
}

/** Days this week you finished all three. */
export function daysLitInWeek(book: Pick<QuestBook, 'lit' | 'week'>): number {
  const end = shiftDay(book.week, -7);
  return book.lit.filter((d) => d >= book.week && d < end).length;
}

/** Days in a row you finished all three, up to today (or yesterday, while today's still open). */
export function streakOf(lit: readonly string[], today: string): number {
  const set = new Set(lit);
  let day = set.has(today) ? today : shiftDay(today, 1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = shiftDay(day, 1);
  }
  return n;
}

/** The most days in a row you ever finished all three (within the kept history). */
export function longestStreak(lit: readonly string[]): number {
  const days = [...new Set(lit)].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && shiftDay(days[i], 1) === days[i - 1] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** The last seven days, oldest first, lit or not, for the streak row. */
export function weekRow(lit: readonly string[], today: string): { day: string; lit: boolean; today: boolean }[] {
  const set = new Set(lit);
  return Array.from({ length: 7 }, (_, i) => {
    const day = shiftDay(today, 6 - i);
    return { day, lit: set.has(day), today: day === today };
  });
}

/** One letter for a day: M T W T F S S. */
export const dayLetter = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return 'SMTWTFS'[new Date(y, m - 1, d).getDay()];
};

/** Glow levels, the light getting bigger as you go. After Afterglow it counts on: Afterglow 2, 3, … */
export const LEVELS: readonly { name: string; from: number }[] = [
  { name: 'Spark', from: 0 },
  { name: 'Flicker', from: 100 },
  { name: 'Glow', from: 250 },
  { name: 'Neon', from: 450 },
  { name: 'Strobe', from: 700 },
  { name: 'Laser', from: 1000 },
  { name: 'Lightshow', from: 1400 },
  { name: 'Aurora', from: 1900 },
  { name: 'Headliner', from: 2500 },
  { name: 'Supernova', from: 3200 },
  { name: 'Afterglow', from: 4000 },
];
/** Each level after the last needs this much more. */
export const LEVEL_STEP_AFTER = 1200;

export type Level = { level: number; name: string; from: number; to: number; glow: number; progress: number };

/** Your level for this much glow: its number, name, where it started and where the next one is. */
export function levelOf(glow: number): Level {
  const g = Math.max(0, Math.floor(glow));
  let i = LEVELS.length - 1;
  while (i > 0 && LEVELS[i].from > g) i--;
  if (i < LEVELS.length - 1) {
    const from = LEVELS[i].from;
    const to = LEVELS[i + 1].from;
    return { level: i + 1, name: LEVELS[i].name, from, to, glow: g, progress: (g - from) / (to - from) };
  }
  const last = LEVELS[LEVELS.length - 1];
  const extra = Math.floor((g - last.from) / LEVEL_STEP_AFTER);
  const from = last.from + extra * LEVEL_STEP_AFTER;
  return {
    level: LEVELS.length + extra,
    name: extra ? `${last.name} ${extra + 1}` : last.name,
    from,
    to: from + LEVEL_STEP_AFTER,
    glow: g,
    progress: (g - from) / LEVEL_STEP_AFTER,
  };
}

/** Glow for each secret found. */
export const SECRET_FIND_GLOW = 50;

/** All your glow: daily and weekly quests, plus side quests, milestones and secrets. */
export const totalGlow = (book: Pick<QuestBook, 'glow'> | undefined, sideQuests: number, milestones: number, secrets = 0) =>
  (book?.glow ?? 0) + sideQuests * SIDE_QUEST_GLOW + milestones * MILESTONE_GLOW + secrets * SECRET_FIND_GLOW;

/** "New quests in 5 h" / "in 40 min". */
export function turnsOverIn(now: number): string {
  const next = dayStart(shiftDay(questDay(now), -1));
  const min = Math.max(1, Math.round((next - now) / 60_000));
  return min >= 60 ? `New quests in ${Math.round(min / 60)} h` : `New quests in ${min} min`;
}

/** Reads a saved book back, or nothing when it's broken. */
export function cleanBook(raw: unknown): QuestBook | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const b = raw as Record<string, unknown>;
  const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const counts = (v: unknown): Counters | undefined => {
    if (!v || typeof v !== 'object') return undefined;
    const c = v as Record<string, unknown>;
    const out: Record<CountKey, string[]> = { likes: [], saves: [], through: [], rated: [], warm: [], follows: [], stars: [] };
    for (const k of COUNT_KEYS) {
      const list = c[k];
      if (!Array.isArray(list)) return undefined;
      out[k] = list.filter((x): x is string => typeof x === 'string').slice(0, IDS_MAX);
    }
    return out;
  };
  if (!isDay(b.day) || !isDay(b.week)) return undefined;
  const base = counts(b.base);
  const weekBase = counts(b.weekBase);
  if (!base || !weekBase) return undefined;
  const ids = new Set<string>(DAILY.map((d) => d.id));
  const events: Partial<Record<QuestEvent, number>> = {};
  if (b.events && typeof b.events === 'object')
    for (const e of QUEST_EVENTS) {
      const n = (b.events as Record<string, unknown>)[e];
      if (typeof n === 'number' && n > 0) events[e] = Math.floor(n);
    }
  return {
    day: b.day,
    base,
    events,
    done: Array.isArray(b.done) ? (b.done.filter((d) => typeof d === 'string' && ids.has(d)) as DailyQuestId[]) : [],
    picks: Array.isArray(b.picks) && b.picks.length === 3 && b.picks.every((d) => typeof d === 'string' && ids.has(d)) ? (b.picks as DailyQuestId[]) : undefined,
    week: b.week,
    weekBase,
    weekDone: b.weekDone === true,
    lit: Array.isArray(b.lit) ? [...new Set(b.lit.filter(isDay))].sort().slice(-HISTORY_DAYS) : [],
    glow: typeof b.glow === 'number' && Number.isFinite(b.glow) && b.glow > 0 ? Math.floor(b.glow) : 0,
  };
}

