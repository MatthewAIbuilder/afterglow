import type { Festival } from '../../data/models';
import { nextRun, runsOf } from './when';

/**
 * How festivals read on the Festivals tab's timeline and its "Up next" card,
 * pure: a calendar-style date block ("DEC" over "4–6") and a big countdown
 * ("62" over "days to go"). "Today" is passed in.
 */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * A date block: the month the festival starts and its days ("4–6"; "31–1"
 * across a month; "2–11" for a festival over two weekends). Undefined without
 * dates.
 */
export function dateBlock(festival: Pick<Festival, 'startDate' | 'endDate' | 'weekends'>): { month: string; days: string } | undefined {
  const start = festival.weekends?.[0]?.start ?? festival.startDate;
  if (!start) return undefined;
  const end = festival.weekends?.[festival.weekends.length - 1]?.end ?? festival.endDate ?? start;
  const month = MONTHS[Number(start.slice(5, 7)) - 1];
  const a = Number(start.slice(8, 10));
  const b = Number(end.slice(8, 10));
  if (!month || !a) return undefined;
  return { month, days: end === start || !b ? `${a}` : `${a}–${b}` };
}

export type BigCountdown = { value: string; unit: string; live?: boolean };

/**
 * A countdown big enough to be the point of a card: "62" / "days to go",
 * "3" / "months to go" from 100 days, "1" / "day to go", "Now" / "happening"
 * (live), "4" / "days to weekend 2" between weekends. Undefined without
 * dates or once it's over.
 */
export function bigCountdown(festival: Festival, today: Date): BigCountdown | undefined {
  if (!runsOf(festival).length) return undefined;
  const next = nextRun(festival, today);
  if (!next) return undefined;
  const { until, index } = next;
  if (until <= 0) return { value: 'Now', unit: index > 0 ? `weekend ${index + 1}` : 'happening', live: true };
  if (index > 0) return { value: `${until}`, unit: until === 1 ? `day to weekend ${index + 1}` : `days to weekend ${index + 1}` };
  if (until >= 100) return { value: `${Math.round(until / 30.4)}`, unit: 'months to go' };
  return { value: `${until}`, unit: until === 1 ? 'day to go' : 'days to go' };
}
