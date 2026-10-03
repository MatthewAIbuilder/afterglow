/**
 * Reading a lineup or set times pasted as plain text, pure: day headings
 * ("Friday", "SAT DEC 5"), stage headings ("Main Stage", "Bass Tent:"), set
 * lines ("10:00 PM SUBTRONICS", "22:00–23:30 LEVITY @ Bass Tent",
 * "TAPE B 11pm - 12:15am") and plain names (a lineup, one per line or
 * "A • B • C"). Whatever can't be read is listed, never guessed away.
 */

export type ReadSet = {
  name: string;
  day?: string;
  stage?: string;
  /** "HH:MM", 24 hours. */
  start: string;
  end?: string;
  /** No AM or PM was written, so it was worked out from the sets around it. */
  guessed?: boolean;
  line: number;
};

export type ReadAct = { name: string; days: string[] };

export type ReadList = {
  days: string[];
  stages: string[];
  /** Everyone named, in the order they first appear (sets included). */
  acts: ReadAct[];
  sets: ReadSet[];
  /** Lines that looked like something but couldn't be read (shown for checking). */
  unread: string[];
};

const WEEKDAY = [
  ['sunday', 'sun'],
  ['monday', 'mon'],
  ['tuesday', 'tue', 'tues'],
  ['wednesday', 'wed'],
  ['thursday', 'thu', 'thur', 'thurs'],
  ['friday', 'fri'],
  ['saturday', 'sat'],
] as const;
const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STAGE_WORDS = /\b(stage|tent|arena|pavilion|dome|grove|garden|hangar|warehouse|room|field|cove|lounge|deck|terrace)\b/i;
const BULLET = /^\s*(?:[-*•·◦▪►>]+|\d{1,3}[.)])\s+/;
const SPLIT = /\s+(?:[•·|\/]|\*)\s+/;

const lower = (s: string) => s.toLowerCase();
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const strip = (s: string) => clean(s.replace(/^[\s\-–—:|,@]+|[\s\-–—:|,@]+$/g, ''));

/** "Friday", "FRI DEC 5", "Saturday, December 6" → the weekday's name; a heading the festival uses ("Dec 30") → itself. */
export function dayHeading(line: string, known: readonly string[] = []): string | undefined {
  const t = clean(line.replace(/[:.]+$/, ''));
  if (!t || t.length > 40) return undefined;
  const k = known.find((d) => lower(d) === lower(t));
  if (k) return k;
  const first = lower(t.split(/[\s,]+/)[0] ?? '');
  const i = WEEKDAY.findIndex((names) => (names as readonly string[]).includes(first));
  if (i < 0) return undefined;
  // Only a heading: the rest may be a date ("Dec 5", "12/5"), nothing like a name.
  const rest = t.slice(first.length).replace(/^[\s,]+/, '');
  if (rest && !/^(?:[a-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:[/.-]\d{1,2}){1,2}|\d{1,2}(?:st|nd|rd|th)?(?:\s+[a-z]{3,9})?)(?:,?\s*\d{4})?$/i.test(rest)) return undefined;
  return DAY_NAME[i];
}

const TIME_RE = /(\d{1,2})(?:[:.h](\d{2}))?(?:\s*(a\.?m\.?|p\.?m\.?|a|p)(?![a-z]))?(?![\d:])/i;
const RANGE_RE = new RegExp(`(?<![\\d:])${TIME_RE.source}(?:\\s*(?:-|–|—|to|till|until)\\s*${TIME_RE.source})?`, 'gi');

type Clock = { h: number; m: number; marker?: 'am' | 'pm' };

function clockOf(h: string, m: string | undefined, marker: string | undefined): Clock | undefined {
  const hh = Number(h);
  const mm = m ? Number(m) : 0;
  const mk = marker ? (lower(marker).startsWith('a') ? 'am' : 'pm') : undefined;
  if (mm > 59) return undefined;
  if (mk ? hh < 1 || hh > 12 : hh > 23) return undefined;
  return { h: hh, m: mm, marker: mk };
}

const to24 = (c: Clock, marker: 'am' | 'pm') => ((c.h % 12) + (marker === 'pm' ? 12 : 0)) * 60 + c.m;
/** Minutes after noon (festival nights run noon to noon). */
const night = (min: number) => (min - 720 + 1440) % 1440;
const fmt = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** A time with no AM/PM: 24-hour when it can only be that, else the reading closest after the set before it. */
function unmarked(c: Clock, after: number | undefined): { min: number; guessed: boolean } {
  if (c.h === 0 || c.h > 12) return { min: c.h * 60 + c.m, guessed: false };
  const am = to24(c, 'am');
  const pm = to24(c, 'pm');
  if (after === undefined) return { min: c.h >= 1 && c.h <= 5 ? am : pm, guessed: true };
  const gap = (x: number) => (night(x) - night(after) + 1440) % 1440;
  return { min: gap(am) < gap(pm) ? am : pm, guessed: true };
}

/** The first time or time range in a line, as 24-hour times, and what's left around it. */
export function readTimes(line: string, after?: number): { start: number; end?: number; guessed: boolean; rest: string } | undefined {
  // The first stretch that really is a time ("10:00", "10pm", "9-11 PM"), never "Stage 2" or "2026".
  let m: RegExpExecArray | null = null;
  let a: Clock | undefined;
  let b: Clock | undefined;
  for (const x of line.matchAll(RANGE_RE)) {
    const xa = clockOf(x[1], x[2], x[3]);
    const xb = x[4] ? clockOf(x[4], x[5], x[6]) : undefined;
    if (!xa || (x[4] && !xb)) continue;
    if (!x[2] && !x[3] && !(xb && (x[5] || x[6]))) continue;
    m = x;
    a = xa;
    b = xb;
    break;
  }
  if (!m || !a) return undefined;
  let guessed = false;
  let start: number;
  let end: number | undefined;
  if (b) {
    const endMarker = b.marker ?? a.marker;
    const e = endMarker ? to24(b, endMarker) : unmarked(b, after).min;
    if (!b.marker && !a.marker) guessed = b.h <= 12 && b.h !== 0;
    if (a.marker) start = to24(a, a.marker);
    else if (b.marker) {
      // "11:30–1:00 AM": the start takes whichever reading comes just before the end.
      const options = [to24(a, 'am'), to24(a, 'pm')].map((s) => ({ s, gap: (night(e) - night(s) + 1440) % 1440 }));
      start = options.filter((o) => o.gap > 0 && o.gap <= 360).sort((x, y) => x.gap - y.gap)[0]?.s ?? to24(a, b.marker);
    } else {
      const u = unmarked(a, after);
      start = u.min;
      guessed = guessed || u.guessed;
    }
    end = e;
  } else {
    if (a.marker) start = to24(a, a.marker);
    else {
      const u = unmarked(a, after);
      start = u.min;
      guessed = u.guessed;
    }
  }
  const rest = clean(line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length));
  return { start, end, guessed, rest };
}

/** "SUBTRONICS @ Bass Tent", "LEVITY (Main Stage)", "TAPE B | Grove" → the act and a stage, when one is named. */
export function actAndStage(text: string, knownStages: readonly string[] = []): { name: string; stage?: string } {
  const t = strip(text);
  const paren = /^(.*?)\s*[([]([^)\]]+)[)\]]\s*$/.exec(t);
  if (paren && (STAGE_WORDS.test(paren[2]) || knownStages.some((s) => lower(s) === lower(paren[2].trim())))) return { name: strip(paren[1]), stage: clean(paren[2]) };
  for (const sep of [/\s+@\s+/, /\s+\|\s+/, /\t+/, /\s+[-–—]\s+/]) {
    const parts = t.split(sep);
    if (parts.length === 2) {
      const [x, y] = parts.map(strip);
      const isStage = (s: string) => STAGE_WORDS.test(s) || knownStages.some((k) => lower(k) === lower(s));
      if (sep.source.includes('@') && y) return { name: x, stage: y };
      if (isStage(y) && x) return { name: x, stage: y };
      if (isStage(x) && y) return { name: y, stage: x };
    }
  }
  return { name: t };
}

/** A heading for a stage: no time, and it says stage/tent/… or ends with ":" or is one the festival has. */
function stageHeading(line: string, knownStages: readonly string[]): string | undefined {
  const t = clean(line);
  if (!t || t.length > 50) return undefined;
  const bare = t.replace(/:$/, '').trim();
  if (knownStages.some((s) => lower(s) === lower(bare))) return knownStages.find((s) => lower(s) === lower(bare));
  if (t.endsWith(':') && bare.split(' ').length <= 5) return bare;
  if (STAGE_WORDS.test(bare) && bare.split(' ').length <= 5 && !/\bb[2-4]b\b/i.test(bare)) return bare;
  return undefined;
}

const NOISE = /^(?:lineup|line-up|line up|set times|schedule|timetable|presents|and more|\+ more|more tba|tba|tbc|plus|featuring|feat\.?|with)$/i;

export function readSetList(text: string, opts: { days?: readonly string[]; stages?: readonly string[] } = {}): ReadList {
  const days: string[] = [];
  const stages: string[] = [];
  const acts = new Map<string, ReadAct>();
  const sets: ReadSet[] = [];
  const unread: string[] = [];
  let day: string | undefined;
  let stage: string | undefined;
  const last = new Map<string, number>();
  const knownStages = [...(opts.stages ?? [])];

  const addAct = (name: string, onDay?: string) => {
    const key = lower(name);
    const a = acts.get(key) ?? { name, days: [] };
    if (onDay && !a.days.includes(onDay)) a.days.push(onDay);
    acts.set(key, a);
  };

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = clean(raw.replace(BULLET, ''));
    if (!line || /^[-=_*~.]+$/.test(line) || NOISE.test(line)) return;
    const d = dayHeading(line, opts.days);
    if (d) {
      day = d;
      stage = undefined;
      if (!days.includes(d)) days.push(d);
      return;
    }
    const times = readTimes(line, last.get(`${day}|${stage}`));
    if (times) {
      const { name, stage: named } = actAndStage(times.rest, [...knownStages, ...stages]);
      if (!name || name.length > 80 || /^\d+$/.test(name)) {
        unread.push(raw.trim());
        return;
      }
      const onStage = named ?? stage;
      if (onStage && !stages.some((s) => lower(s) === lower(onStage))) stages.push(onStage);
      const set: ReadSet = { name, start: fmt(times.start), line: i + 1 };
      if (day) set.day = day;
      if (onStage) set.stage = stages.find((s) => lower(s) === lower(onStage));
      if (times.end !== undefined) set.end = fmt(times.end);
      if (times.guessed) set.guessed = true;
      sets.push(set);
      last.set(`${day}|${stage}`, times.start);
      addAct(name, day);
      return;
    }
    const s = stageHeading(line, knownStages);
    if (s) {
      stage = s;
      if (!stages.some((x) => lower(x) === lower(s))) stages.push(s);
      return;
    }
    // A plain lineup line: one name, or several split by • · | / (or commas when there are a few).
    const parts = (SPLIT.test(line) ? line.split(SPLIT) : (line.match(/,/g)?.length ?? 0) >= 2 ? line.split(',') : [line]).map(strip).filter(Boolean);
    for (const p of parts) {
      if (p.length > 80 || /^\d+$/.test(p) || NOISE.test(p)) unread.push(p);
      else addAct(p, day);
    }
  });

  return { days, stages, acts: [...acts.values()], sets, unread };
}

/** Each set's end: as written, else when the next set on that stage starts (within 3 h), else an hour on. */
export function withEnds(sets: readonly ReadSet[]): (ReadSet & { end: string; endGuessed?: boolean })[] {
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return sets.map((s) => {
    if (s.end) return s as ReadSet & { end: string };
    const next = sets
      .filter((o) => o !== s && o.day === s.day && o.stage === s.stage)
      .map((o) => (night(mins(o.start)) - night(mins(s.start)) + 1440) % 1440)
      .filter((g) => g > 0 && g <= 180)
      .sort((a, b) => a - b)[0];
    return { ...s, end: fmt((mins(s.start) + (next ?? 60)) % 1440), endGuessed: true };
  });
}
