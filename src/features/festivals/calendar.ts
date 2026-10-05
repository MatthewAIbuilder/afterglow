import type { Festival } from '../../data/models';
import { runsOf } from './when';

/**
 * The festival calendar, pure: a month as weeks (Monday first), which
 * festivals are on each day, and which months are worth flipping through.
 */
export type Month = { year: number; month: number }; // month 0 to 11

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** Monday first. */
export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const monthOf = (d: Date): Month => ({ year: d.getFullYear(), month: d.getMonth() });
export const addMonths = (m: Month, by: number): Month => {
  const d = new Date(m.year, m.month + by, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};
export const sameMonth = (a: Month, b: Month) => a.year === b.year && a.month === b.month;
export const monthTitle = (m: Month, today: Date) => (m.year === today.getFullYear() ? MONTH_NAMES[m.month] : `${MONTH_NAMES[m.month]} ${m.year}`);

/** The month as weeks of day keys, with blanks (undefined) before the 1st and after the last. */
export function monthGrid(m: Month): (string | undefined)[][] {
  const first = new Date(m.year, m.month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(m.year, m.month + 1, 0).getDate();
  const cells: (string | undefined)[] = [...Array(lead).fill(undefined), ...Array.from({ length: days }, (_, i) => dayKey(m.year, m.month, i + 1))];
  while (cells.length % 7) cells.push(undefined);
  const weeks: (string | undefined)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Festivals on a day (either weekend of a two-weekend festival, not the days between). */
export function festivalsOn(festivals: readonly Festival[], day: string): Festival[] {
  return festivals.filter((f) => runsOf(f).some((r) => r.start <= day && day <= r.end));
}

/** Every day key in a month with at least one festival on, and which. */
export function monthFestivals(festivals: readonly Festival[], m: Month): Map<string, Festival[]> {
  const out = new Map<string, Festival[]>();
  const days = new Date(m.year, m.month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const key = dayKey(m.year, m.month, d);
    const on = festivalsOn(festivals, key);
    if (on.length) out.set(key, on);
  }
  return out;
}

/** The months you can flip through: from this month to the last one with a festival, at most 18. */
export function calendarMonths(festivals: readonly Festival[], today: Date): Month[] {
  const start = monthOf(today);
  const ends = festivals.flatMap((f) => runsOf(f).map((r) => r.end)).sort();
  const last = ends.length ? ends[ends.length - 1] : undefined;
  const months: Month[] = [start];
  if (!last) return months;
  const [ly, lm] = last.split('-').map(Number);
  let m = start;
  while (months.length < 18) {
    m = addMonths(m, 1);
    if (m.year > ly || (m.year === ly && m.month > lm - 1)) break;
    months.push(m);
  }
  return months;
}

/** "3 festivals in November" / "No festivals in March yet"; with a reach, "2 festivals within 100 mi in November". */
export function monthLine(n: number, m: Month, where = ''): string {
  const w = where ? ` ${where}` : '';
  const month = MONTH_NAMES[m.month];
  return n === 0 ? `No festivals${w} in ${month} yet` : n === 1 ? `1 festival${w} in ${month}` : `${n} festivals${w} in ${month}`;
}
