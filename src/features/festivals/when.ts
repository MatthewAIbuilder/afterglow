import type { Festival } from '../../data/models';
import { t, tn } from '../../i18n';

/**
 * How far away a festival is, in plain words. Pure: "today" is passed in.
 * Calendar days in the phone's own time zone, so "Tomorrow" means tomorrow
 * wherever you are.
 */

const dayNumber = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return dayNumber(y, m, d);
};
const fromDate = (date: Date) => dayNumber(date.getFullYear(), date.getMonth() + 1, date.getDate());

/** Until this hour, a festival night is still the night before (sets run past midnight). */
export const NIGHT_ENDS_HOUR = 7;
/** Still last night's festival: past midnight, before the night ends, the day after `endIso`. */
export const stillLastNight = (endIso: string, today: Date) => today.getHours() < NIGHT_ENDS_HOUR && fromIso(endIso) === fromDate(today) - 1;

/** Whole days from today until the festival starts: 0 on the first day, negative once it's begun. */
export function daysUntil(festival: Festival, today: Date): number | undefined {
  if (!festival.startDate) return undefined;
  return fromIso(festival.startDate) - fromDate(today);
}

/** One stretch of festival days: a weekend, or the whole festival when it runs in one go. */
export type Run = { start: string; end: string };

/**
 * Whether the festival is on: from the first day to the morning after the
 * last (nights run past midnight). For a two-weekend festival, either
 * weekend counts, and the days between them don't.
 */
export function isLive(festival: Festival, today: Date): boolean {
  if (festival.weekends?.length) {
    const t = fromDate(today);
    return festival.weekends.some((r) => fromIso(r.start) <= t && t <= fromIso(r.end) + 1);
  }
  const until = daysUntil(festival, today);
  if (until === undefined || until > 0) return false;
  // From the first day to the day after the last: its dates when it has them, else a day per listed day.
  const span = festival.endDate ? fromIso(festival.endDate) - fromIso(festival.startDate!) + 1 : festival.days.length;
  return until >= -Math.max(1, span);
}

/** The festival's runs in order: its weekends, or one run from start to end. None without dates. */
export function runsOf(festival: Festival): Run[] {
  if (festival.weekends?.length) return festival.weekends;
  if (!festival.startDate) return [];
  return [{ start: festival.startDate, end: festival.endDate ?? festival.startDate }];
}

/**
 * The run that's on now or comes next: which one (0-based), out of how many,
 * and whole days until it starts (0 or less while it's on). Undefined once
 * the last one is over, or without dates.
 */
export function nextRun(festival: Festival, today: Date) {
  const runs = runsOf(festival);
  const t = fromDate(today);
  // The last night's sets after midnight still count as that run.
  const index = runs.findIndex((r) => fromIso(r.end) >= t || stillLastNight(r.end, today));
  if (index < 0) return undefined;
  return { run: runs[index], index, count: runs.length, until: fromIso(runs[index].start) - t };
}

/**
 * "In 38 days", "Tomorrow", "Happening now", "Over". Between the weekends of a
 * festival run over several: "Weekend 2 in 4 days", "Weekend 2 tomorrow".
 * Undefined when the festival has no dates.
 */
export function countdown(festival: Festival, today: Date): string | undefined {
  if (!runsOf(festival).length) return undefined;
  const next = nextRun(festival, today);
  if (!next) return t('Over');
  const { until, index } = next;
  if (until <= 0) return t('Happening now');
  if (index > 0) return until === 1 ? t('Weekend {w} tomorrow', { w: index + 1 }) : t('Weekend {w} in {n} days', { w: index + 1, n: until });
  if (until > 1) return until < 60 ? t('In {n} days', { n: until }) : tn(Math.round(until / 30.4), 'In {n} month', 'In {n} months');
  return t('Tomorrow');

}

/** The line under an artist at a festival: their set time and/or what the lineup says about their set. */
export function setLine(when: string | undefined, note: string | undefined) {
  return [when, note].filter(Boolean).join(' · ') || undefined;
}
