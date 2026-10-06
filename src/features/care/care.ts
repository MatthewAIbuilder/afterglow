/**
 * Look after yourself: private notes for a festival night. Stopwatches (from
 * the timing guide, or in your own words), water and food taps, quick
 * check-ins. Plain data, kept only on this phone (state/care.tsx); never
 * uploaded, never in recaps or profiles. The timing guide (guide.ts) says
 * when effects usually start and wear off, never how much to take. Pure.
 */

import { LANGUAGE, t, tc, tn } from '../../i18n';

export type CareTimer = {
  id: string;
  label: string;
  startedAt: number;
  /** The timing guide entry it follows (guide.ts), if any. */
  guide?: string;
  /** Each time you logged taking more, after the start. */
  doses?: number[];
};
/** How you feel, from great to not great. `rough` is "Not great" (its saved name from before). */
export type Mood = 'great' | 'good' | 'okay' | 'tired' | 'anxious' | 'hot' | 'sick' | 'overwhelmed' | 'rough';
/** In the order they're offered: the good ones, the in-between, then the ones that need care. */
export const MOODS: readonly Mood[] = ['great', 'good', 'okay', 'tired', 'anxious', 'hot', 'overwhelmed', 'sick', 'rough'];
export type CareEntry = { kind: 'water' | 'food'; at: number } | { kind: 'checkin'; at: number; mood: Mood };
export type Care = {
  timers: CareTimer[];
  log: CareEntry[];
  lock: boolean;
  /** Water reminders during a festival night, every this many minutes (off when missing). */
  waterEvery?: WaterEvery;
  /** "How are you feeling?" reminders while a stopwatch runs, every this many minutes (off when missing). */
  feelEvery?: FeelEvery;
};

/** How often water reminders can come. */
export const WATER_EVERY = [45, 60, 90] as const;
export type WaterEvery = (typeof WATER_EVERY)[number];

/** How often "How are you feeling?" reminders can come while a stopwatch runs. */
export const FEEL_EVERY = [30, 45, 60] as const;
export type FeelEvery = (typeof FEEL_EVERY)[number];

export const EMPTY_CARE: Care = { timers: [], log: [], lock: false };
/** Most timers running at once. */
export const TIMERS_MAX = 6;
/** Longest label, in characters. */
export const LABEL_MAX = 40;
/** How many log entries are kept (oldest go first). */
export const LOG_MAX = 300;
/** Notes older than this are dropped when read back: a night's notes aren't a diary. */
export const KEEP_MS = 3 * 24 * 60 * 60 * 1000;

export const MOOD_LABEL: Record<Mood, string> = {
  great: tc('feeling', 'Great'),
  good: tc('feeling', 'Good'),
  okay: tc('feeling', 'Okay'),
  tired: tc('feeling', 'Tired'),
  anxious: tc('feeling', 'Anxious'),
  hot: tc('feeling', 'Too hot'),
  overwhelmed: tc('feeling', 'Overwhelmed'),
  sick: tc('feeling', 'Sick'),
  rough: tc('feeling', 'Not great'),
};

/** Where each feeling sits on the graph, 5 (great) to 1 (not great). */
export const MOOD_LEVEL: Record<Mood, number> = { great: 5, good: 4, okay: 3, tired: 2, anxious: 2, hot: 2, overwhelmed: 1, sick: 1, rough: 1 };

/** Feelings that bring Get help to the top. */
export const HELP_MOODS: readonly Mood[] = ['overwhelmed', 'sick', 'rough'];

/** One plain, useful thing to do for each feeling. */
export const MOOD_TIP: Record<Mood, string> = {
  great: t('Love that. Keep sipping water and check in again in a while.'),
  good: t('Nice. Take breaks from dancing now and then, and keep sipping water.'),
  okay: t('Take a breather somewhere calmer, eat something if you can, and check in again soon.'),
  tired: t('Sit down for a while, eat something and have some water. Taking more to push through tends to make things worse.'),
  anxious: t('Breathe slowly: in for 4, out for 6. Find a quieter spot with a friend. Feelings like this pass.'),
  hot: t('Get out of the crowd to shade or the chill-out area, take off a layer and sip water. If you stop sweating, feel confused or faint, get help now.'),
  overwhelmed: t('Find somewhere quieter with a friend and sit down. Medics and welfare tents are there for exactly this.'),
  sick: t('Sit down somewhere cool with a friend. If you’re being sick and can’t keep water down, or feel confused, get help.'),
  rough: t('Tell a friend and stay with them. Help is close if you need it.'),
};

const MIN = 60_000;

export function startTimer(care: Care, label: string, now: number, id = `t${now.toString(36)}`, guide?: string): Care {
  if (care.timers.length >= TIMERS_MAX) return care;
  const clean = label.replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX);
  return { ...care, timers: [...care.timers, { id, label: clean, startedAt: now, ...(guide ? { guide } : {}) }] };
}

/** Most extra doses remembered on one stopwatch. */
export const DOSES_MAX = 20;

/** You took more: logged on the stopwatch (its window restarts from now). */
export function tookMore(care: Care, id: string, now: number): Care {
  return { ...care, timers: care.timers.map((t) => (t.id === id ? { ...t, doses: [...(t.doses ?? []), now].slice(-DOSES_MAX) } : t)) };
}

/** When you last took it: the start, or the latest time you took more. */
export const lastDose = (t: CareTimer): number => Math.max(t.startedAt, ...(t.doses ?? []));

export const stopTimer = (care: Care, id: string): Care => ({ ...care, timers: care.timers.filter((t) => t.id !== id) });

export function addEntry(care: Care, entry: CareEntry): Care {
  const log = [...care.log, entry].slice(-LOG_MAX);
  return { ...care, log };
}

/** Takes back the newest entry of that kind (an accidental tap). */
export function undoLast(care: Care, kind: CareEntry['kind']): Care {
  const i = care.log.map((e) => e.kind).lastIndexOf(kind);
  return i < 0 ? care : { ...care, log: care.log.filter((_, j) => j !== i) };
}

/** The newest entry of a kind. */
export const lastOf = (care: Care, kind: CareEntry['kind']): CareEntry | undefined => [...care.log].reverse().find((e) => e.kind === kind);

/**
 * When tonight began: noon today, or noon yesterday before noon (festival
 * nights run noon to noon, like set times), in the phone's time.
 */
export function nightStart(now: number): number {
  const d = new Date(now);
  const noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
  return now >= noon ? noon : noon - 24 * 60 * MIN;
}

/** How many of a kind since tonight began. */
export const countTonight = (care: Care, kind: CareEntry['kind'], now: number) => care.log.filter((e) => e.kind === kind && e.at >= nightStart(now)).length;

/** "Just now", "12 min", "1 h 5 min", "3 h": for elapsed times, easy to read at a glance. */
export function elapsed(ms: number): string {
  const m = Math.max(0, Math.floor(ms / MIN));
  if (m < 1) return t('Just now');
  if (m < 60) return t('{n} min', { n: m });
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? t('{h} h {m} min', { h, m: r }) : t('{n} h', { n: h });
}

/** "Last one 40 min ago", "None yet tonight". */
export function lastLine(care: Care, kind: CareEntry['kind'], now: number): string {
  const last = lastOf(care, kind);
  if (!last || last.at < nightStart(now)) return t('None yet tonight');
  if (now - last.at < MIN) return t('Just now');
  return t('Last {time} ago', { time: elapsed(now - last.at) });
}

/** Whether the latest check-in tonight was one that needs care (not great, sick, overwhelmed): help comes first then. */
export function needsHelp(care: Care, now: number): boolean {
  const last = lastOf(care, 'checkin');
  return !!last && last.kind === 'checkin' && HELP_MOODS.includes(last.mood) && last.at >= nightStart(now);
}

/** Your latest feeling tonight, if you've checked in. */
export function lastFeeling(care: Care, now: number): { mood: Mood; at: number } | undefined {
  const last = lastOf(care, 'checkin');
  return last && last.kind === 'checkin' && last.at >= nightStart(now) ? { mood: last.mood, at: last.at } : undefined;
}

export type FeelingPoint = { at: number; mood: Mood; level: number };

/** Every check-in between two moments, oldest first, for the graph. */
export function feelingsBetween(care: Care, from: number, to: number): FeelingPoint[] {
  return care.log
    .filter((e): e is Extract<CareEntry, { kind: 'checkin' }> => e.kind === 'checkin' && e.at >= from && e.at <= to)
    .map((e) => ({ at: e.at, mood: e.mood, level: MOOD_LEVEL[e.mood] }));
}

/** The groups the feelings are offered in: the good ones as big orbs, then something's off, then needing a hand. */
export type MoodGroup = { id: 'fine' | 'off' | 'hand'; title?: string; moods: Mood[] };
/** The feelings offered under "Need a hand" (like sick, they bring Get help to the top). */
export const HAND_MOODS: readonly Mood[] = ['overwhelmed', 'rough'];
/** Every feeling once, in `MOODS` order: okay or better, then the rest, then the ones asking for a hand. */
export const MOOD_GROUPS: readonly MoodGroup[] = [
  { id: 'fine', moods: MOODS.filter((m) => MOOD_LEVEL[m] >= 3) },
  { id: 'off', title: t('Something’s off'), moods: MOODS.filter((m) => MOOD_LEVEL[m] < 3 && !HAND_MOODS.includes(m)) },
  { id: 'hand', title: t('Need a hand'), moods: MOODS.filter((m) => HAND_MOODS.includes(m)) },
];

/** "9 PM", "10:30" (short, for the graph) or "10:30 PM" (`ampm`), in the phone's time; Spanish uses the 24-hour clock ("21:00", "22:30"). */
export function clockShort(ms: number, ampm = false): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  if (LANGUAGE === 'es') return `${h}:${String(m).padStart(2, '0')}`;
  const hh = h % 12 === 0 ? 12 : h % 12;
  const suffix = h >= 12 ? 'PM' : 'AM';
  if (!m) return `${hh} ${suffix}`;
  return `${hh}:${String(m).padStart(2, '0')}${ampm ? ` ${suffix}` : ''}`;
}

/**
 * The times under tonight's graph: the first check-in, `between` evenly
 * spaced times (to the quarter hour) when the night is long enough, and
 * "Now" once it's a little later than the first.
 */
export function graphTimes(from: number, now: number, between = 2): { at: number; label: string }[] {
  const span = now - from;
  const out = [{ at: from, label: clockShort(from) }];
  const quarter = 15 * MIN;
  if (span >= (between + 1) * 30 * MIN) {
    for (let i = 1; i <= between; i++) {
      const at = Math.round((from + (span * i) / (between + 1)) / quarter) * quarter;
      out.push({ at, label: clockShort(at) });
    }
  }
  if (span >= 20 * MIN) out.push({ at: now, label: t('Now') });
  return out;
}

/**
 * A low point tonight you've felt better than since: the latest check-in at
 * level 2 or lower, when it isn't the latest one. Only what you told the
 * app, never a guess at why.
 */
export function recoveryFrom(points: FeelingPoint[]): FeelingPoint | undefined {
  const i = points.map((p) => p.level <= 2).lastIndexOf(true);
  return i < 0 || i === points.length - 1 ? undefined : points[i];
}

/** "You felt too hot at 10:30 PM, and you’ve been feeling better since." */
export function recoveryLine(low: FeelingPoint): string {
  const time = clockShort(low.at, true);
  if (low.mood === 'rough') return t('You weren’t feeling great at {time}, and you’ve been feeling better since.', { time });
  return t('You felt {feeling} at {time}, and you’ve been feeling better since.', { feeling: MOOD_LABEL[low.mood].toLowerCase(), time });
}

/** The lowest check-ins tonight, when they're lower than the rest (labelled under the graph). */
export function lowestPoints(points: FeelingPoint[]): FeelingPoint[] {
  if (points.length < 2) return [];
  const levels = points.map((p) => p.level);
  const min = Math.min(...levels);
  return min < Math.max(...levels) ? points.filter((p) => p.level === min) : [];
}

/** Tonight in words for screen readers: "Tonight, 3 check-ins: 9 PM good, 10:30 PM too hot, 11:45 PM great." */
export function nightSummary(points: FeelingPoint[]): string {
  const list = points.map((p) => `${clockShort(p.at, true)} ${MOOD_LABEL[p.mood].toLowerCase()}`).join(', ');
  return tn(points.length, 'Tonight, {n} check-in: {list}.', 'Tonight, {n} check-ins: {list}.', { list });
}

/** The one line on the festival page's card: what's running and when you last drank. */
export function cardLine(care: Care, now: number): string {
  const parts: string[] = [];
  const first = care.timers[0];
  if (first) parts.push(t('{name} {time}', { name: first.label || t('Stopwatch'), time: elapsed(now - first.startedAt) }));
  const water = lastOf(care, 'water');
  if (water && water.at >= nightStart(now)) parts.push(t('water {time} ago', { time: elapsed(now - water.at) }));
  return parts.length ? parts.join(' · ').replace(/^./, (c) => c.toUpperCase()) : t('Stopwatches, water and check-ins, private to you');
}

/** The region in a locale: "en-US" -> "US", "es_419" -> undefined. */
export const regionOf = (locale: string | undefined): string | undefined => locale?.match(/[-_]([A-Za-z]{2})(?:[-_]|$)/)?.[1]?.toUpperCase();

/** Emergency number for the phone's region: 911 in North America, 999 in the UK, 000 in Australia, 112 elsewhere (works across Europe and on most phones). */
export function emergencyNumber(region: string | undefined): string {
  const r = (region ?? '').toUpperCase();
  if (['US', 'CA', 'MX', 'PR'].includes(r)) return '911';
  if (r === 'GB') return '999';
  if (r === 'AU') return '000';
  if (r === 'NZ') return '111';
  return '112';
}

/** Saved notes read back safely: anything malformed or older than `KEEP_MS` is dropped. */
export function cleanCare(raw: unknown, now: number): Care {
  if (!raw || typeof raw !== 'object') return EMPTY_CARE;
  const o = raw as Record<string, unknown>;
  const fresh = (at: unknown): at is number => typeof at === 'number' && at > now - KEEP_MS && at <= now + MIN;
  const timers = (Array.isArray(o.timers) ? o.timers : [])
    .filter((t): t is CareTimer => !!t && typeof t === 'object' && typeof (t as CareTimer).id === 'string' && typeof (t as CareTimer).label === 'string' && fresh((t as CareTimer).startedAt))
    .slice(0, TIMERS_MAX)
    .map((t) => {
      const guide = typeof t.guide === 'string' && /^[a-z-]{1,20}$/.test(t.guide) ? t.guide : undefined;
      const doses = (Array.isArray(t.doses) ? t.doses : []).filter((d) => fresh(d) && d >= t.startedAt).slice(-DOSES_MAX);
      return { id: t.id, label: t.label.slice(0, LABEL_MAX), startedAt: t.startedAt, ...(guide ? { guide } : {}), ...(doses.length ? { doses } : {}) };
    });
  const log = (Array.isArray(o.log) ? o.log : [])
    .filter((e): e is CareEntry => {
      if (!e || typeof e !== 'object' || !fresh((e as CareEntry).at)) return false;
      const k = (e as CareEntry).kind;
      if (k === 'water' || k === 'food') return true;
      return k === 'checkin' && (MOODS as readonly string[]).includes((e as { mood?: string }).mood ?? '');
    })
    .sort((a, b) => a.at - b.at)
    .slice(-LOG_MAX);
  const waterEvery = WATER_EVERY.find((m) => m === o.waterEvery);
  const feelEvery = FEEL_EVERY.find((m) => m === o.feelEvery);
  return { timers, log, lock: o.lock === true, ...(waterEvery ? { waterEvery } : {}), ...(feelEvery ? { feelEvery } : {}) };
}
