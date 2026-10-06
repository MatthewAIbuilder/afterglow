import type { Festival } from '../../data/types';
import { t } from '../../i18n';
import { formatTime } from '../festivals/format';
import { toMinutes } from './plan';

/**
 * Your hours on a festival day: when you get there, when you go home, and
 * breaks you've planned (dinner, a rest, meeting someone). Pure.
 *
 * Every time is in minutes on the festival-day clock, the same one the route
 * uses (`toMinutes`: anything before 7 AM belongs to the night before and runs
 * past 24:00, so 1:00 AM is 1500). No arrive means from the start; no leave
 * means to the end. Planning only: it never feeds your taste.
 */
export type HoursBreak = { from: number; to: number; label?: string };
export type DayHours = { arrive?: number; leave?: number; breaks: HoursBreak[] };
/** A festival's hours, by day name. */
export type FestivalHours = Record<string, DayHours>;

/** Steps for every time you set. */
export const HOURS_STEP = 15;
/** At most this many breaks a day. */
export const MAX_BREAKS = 4;
/** A break's label is at most this long. */
export const BREAK_LABEL_MAX = 24;
/** Times can be set from this long before the day's first set… */
export const BEFORE_FIRST = 120;
/** …to this long after its last one. */
export const AFTER_LAST = 60;
/** A new break lasts this long. */
export const NEW_BREAK = 60;
/** The labels offered for a break. Saved as written here (English); `breakLabel` shows them in the app's language. */
export const BREAK_LABELS = ['Dinner', 'Rest', 'Meet up'] as const;

const BREAK_LABEL_SHOWN: Record<string, () => string> = {
  Dinner: () => t('Dinner'),
  Rest: () => t('Rest'),
  'Meet up': () => t('Meet up'),
};

/** A break's label as shown: one of `BREAK_LABELS` in the app's language, your own words as you wrote them. */
export const breakLabel = (label: string) => BREAK_LABEL_SHOWN[label]?.() ?? label;

const isTime = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/**
 * Tidies hours read from storage or the editor: arrive before leave, breaks
 * inside your hours, sorted, overlapping ones merged (the first label wins),
 * at most `MAX_BREAKS`, labels trimmed to `BREAK_LABEL_MAX`. Undefined when
 * nothing is set (all day).
 */
export function cleanHours(raw: unknown): DayHours | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const arrive = isTime(r.arrive) ? Math.round(r.arrive) : undefined;
  let leave = isTime(r.leave) ? Math.round(r.leave) : undefined;
  if (arrive !== undefined && leave !== undefined && arrive >= leave) leave = undefined;
  const lo = arrive ?? -Infinity;
  const hi = leave ?? Infinity;
  const breaks: HoursBreak[] = [];
  const list = Array.isArray(r.breaks) ? r.breaks : [];
  const parsed = list
    .flatMap((b): HoursBreak[] => {
      if (!b || typeof b !== 'object') return [];
      const x = b as Record<string, unknown>;
      if (!isTime(x.from) || !isTime(x.to)) return [];
      const from = Math.max(lo, Math.round(x.from));
      const to = Math.min(hi, Math.round(x.to));
      if (from >= to) return [];
      const label = typeof x.label === 'string' ? x.label.trim().slice(0, BREAK_LABEL_MAX).trim() : '';
      return [label ? { from, to, label } : { from, to }];
    })
    .sort((a, b) => a.from - b.from || a.to - b.to);
  for (const b of parsed) {
    const last = breaks[breaks.length - 1];
    if (last && b.from < last.to) last.to = Math.max(last.to, b.to);
    else breaks.push({ ...b });
  }
  breaks.splice(MAX_BREAKS);
  if (arrive === undefined && leave === undefined && !breaks.length) return undefined;
  return { ...(arrive !== undefined ? { arrive } : {}), ...(leave !== undefined ? { leave } : {}), breaks };
}

/** Nothing set: the route plans the whole day. */
export const isAllDay = (h: DayHours | undefined) => !h || (h.arrive === undefined && h.leave === undefined && !h.breaks.length);

/** Minutes on the festival clock -> "1:00 AM". */
export function clockLabel(min: number) {
  const m = ((min % 1440) + 1440) % 1440;
  return formatTime(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`);
}

/** "7:00–8:00 PM", "11:30 PM–12:30 AM"; short drops ":00" when both are on the hour ("7–8 PM"). On the 24-hour clock: "19:00–20:00". */
export function timeRange(from: number, to: number, short = false) {
  const [a, ap] = clockLabel(from).split(' ');
  const [b, bp] = clockLabel(to).split(' ');
  if (!ap || !bp) return `${a}–${b}`;
  const trim = (x: string) => (short && from % 60 === 0 && to % 60 === 0 ? x.replace(/:00$/, '') : x);
  return ap === bp ? `${trim(a)}–${trim(b)} ${bp}` : `${trim(a)} ${ap}–${trim(b)} ${bp}`;
}

const breakName = (b: HoursBreak) => (b.label ? breakLabel(b.label) : t('Break'));

/** "Arriving 4:00 PM · Leaving 2:00 AM · Dinner 7–8 PM" (more than two breaks are counted); "All day" when nothing's set. */
export function hoursLine(h: DayHours | undefined) {
  if (!h || isAllDay(h)) return t('All day');
  const parts: string[] = [];
  if (h.arrive !== undefined) parts.push(t('Arriving {time}', { time: clockLabel(h.arrive) }));
  if (h.leave !== undefined) parts.push(t('Leaving {time}', { time: clockLabel(h.leave) }));
  if (h.breaks.length > 2) parts.push(t('{n} breaks', { n: h.breaks.length }));
  else for (const b of h.breaks) parts.push(t('{break} {time}', { break: breakName(b), time: timeRange(b.from, b.to, true) }));
  return parts.join(' · ');
}

/** The same, in full, for screen readers: "arriving at 4:00 PM, leaving at 2:00 AM, Dinner from 7:00 PM to 8:00 PM". */
export function hoursSaid(h: DayHours | undefined) {
  if (!h || isAllDay(h)) return t('all day');
  const parts: string[] = [];
  if (h.arrive !== undefined) parts.push(t('arriving at {time}', { time: clockLabel(h.arrive) }));
  if (h.leave !== undefined) parts.push(t('leaving at {time}', { time: clockLabel(h.leave) }));
  for (const b of h.breaks) parts.push(t('{break} from {from} to {to}', { break: breakName(b), from: clockLabel(b.from), to: clockLabel(b.to) }));
  return parts.join(', ');
}

/** The times that make sense on a day: `BEFORE_FIRST` before its first set to `AFTER_LAST` after its last, on 15-minute steps. */
export function dayRange(festival: Festival, day: string): { min: number; max: number; first: number; last: number } | undefined {
  const sets = (festival.sets ?? []).filter((s) => s.day === day);
  if (!sets.length) return undefined;
  const spans = sets.map((s) => {
    const start = toMinutes(s.start);
    let end = toMinutes(s.end);
    if (end <= start) end += 24 * 60;
    return { start, end };
  });
  const first = Math.min(...spans.map((s) => s.start));
  const last = Math.max(...spans.map((s) => s.end));
  return {
    first,
    last,
    min: Math.floor((first - BEFORE_FIRST) / HOURS_STEP) * HOURS_STEP,
    max: Math.ceil((last + AFTER_LAST) / HOURS_STEP) * HOURS_STEP,
  };
}

/** One step on from a time (snapped to the 15-minute grid), kept inside [min, max]. */
export function stepTime(at: number, dir: 1 | -1, min: number, max: number) {
  const snapped = dir > 0 ? Math.floor(at / HOURS_STEP) * HOURS_STEP : Math.ceil(at / HOURS_STEP) * HOURS_STEP;
  return Math.min(max, Math.max(min, snapped + dir * HOURS_STEP));
}

/** A new break for the editor: an hour, halfway through your time there, on the grid. */
export function newBreak(h: DayHours | undefined, range: { first: number; last: number }, label: string): HoursBreak {
  const lo = Math.max(h?.arrive ?? range.first, range.first);
  const hi = Math.min(h?.leave ?? range.last, range.last);
  const mid = Math.floor((lo + hi) / 2 / HOURS_STEP) * HOURS_STEP;
  const from = Math.max(lo, mid - NEW_BREAK / 2);
  return { from, to: Math.min(Math.max(hi, from + HOURS_STEP), from + NEW_BREAK), label };
}

/** Why a must-see can't be on your route: it's on before you arrive, after you leave, or during a break. */
export type Missed = {
  why: 'arrive' | 'leave' | 'break';
  /** The set's start and end, on the festival clock. */
  start: number;
  end: number;
  /** The break it falls in (for 'break'). */
  label?: string;
};

/** Minutes of a set you can be at, inside your hours and outside your breaks. */
export function freeMinutes(h: DayHours | undefined, start: number, end: number) {
  if (!h) return end - start;
  const lo = Math.max(start, h.arrive ?? -Infinity);
  const hi = Math.min(end, h.leave ?? Infinity);
  if (lo >= hi) return 0;
  return h.breaks.reduce((left, b) => left - Math.max(0, Math.min(hi, b.to) - Math.max(lo, b.from)), hi - lo);
}

/** Whether a set is out of your hours altogether, and why; undefined when you can catch some of it. */
export function missedBy(h: DayHours | undefined, start: number, end: number): Missed | undefined {
  if (!h || isAllDay(h) || freeMinutes(h, start, end) > 0) return undefined;
  if (h.arrive !== undefined && end <= h.arrive) return { why: 'arrive', start, end };
  if (h.leave !== undefined && start >= h.leave) return { why: 'leave', start, end };
  const brk = h.breaks.find((b) => b.from < end && start < b.to);
  return { why: 'break', start, end, ...(brk?.label ? { label: brk.label } : {}) };
}

/** "SUBTRONICS plays at 1:00 AM, after you leave. Stay later?" */
export function missedLine(name: string, m: Missed) {
  const at = clockLabel(m.start);
  if (m.why === 'arrive') return t('{name} plays at {time}, before you arrive. Come earlier?', { name, time: at });
  if (m.why === 'leave') return t('{name} plays at {time}, after you leave. Stay later?', { name, time: at });
  if (!m.label) return t('{name} plays at {time}, during your break. Move it?', { name, time: at });
  if (m.label === 'Dinner') return t('{name} plays at {time}, during dinner. Move it?', { name, time: at });
  if (m.label === 'Rest') return t('{name} plays at {time}, during rest. Move it?', { name, time: at });
  if (m.label === 'Meet up') return t('{name} plays at {time}, during meet up. Move it?', { name, time: at });
  return t('{name} plays at {time}, during {break}. Move it?', { name, time: at, break: m.label.toLowerCase() });
}

/** The one-tap fix's button: "Stay until 1:30 AM", "Arrive at 10:00 PM", "Remove dinner". */
export function fixLabel(m: Missed) {
  if (m.why === 'arrive') return t('Arrive at {time}', { time: clockLabel(m.start) });
  if (m.why === 'leave') return t('Stay until {time}', { time: clockLabel(m.end) });
  if (!m.label) return t('Remove the break');
  if (m.label === 'Dinner') return t('Remove dinner');
  if (m.label === 'Rest') return t('Remove rest');
  if (m.label === 'Meet up') return t('Remove meet up');
  return t('Remove {break}', { break: m.label.toLowerCase() });
}

/** Your hours with the one-tap fix applied: arrive for the set, stay to its end, or drop the breaks in its way. */
export function makeRoom(h: DayHours, m: Missed): DayHours | undefined {
  if (m.why === 'arrive') return cleanHours({ ...h, arrive: m.start });
  if (m.why === 'leave') return cleanHours({ ...h, leave: m.end });
  return cleanHours({ ...h, breaks: h.breaks.filter((b) => !(b.from < m.end && m.start < b.to)) });
}
