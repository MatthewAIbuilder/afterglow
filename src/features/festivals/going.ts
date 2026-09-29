import type { Festival } from '../../data/models';
import { daysUntil } from './when';

/**
 * The festivals you're going to. A planning choice: it orders the Festivals
 * tab and never touches your taste. Pure.
 */
export type Going = readonly string[];

export function toggleGoing(going: Going, festivalId: string): string[] {
  return going.includes(festivalId) ? going.filter((id) => id !== festivalId) : [...going, festivalId];
}

/** Keep only well-formed, unique ids, e.g. when reading them back from storage. */
export function cleanGoing(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

/**
 * The Festivals tab in two groups: the ones you're going to, soonest first
 * (finished ones and ones without dates after), and everything else in
 * catalogue order.
 */
export function groupFestivals(festivals: Festival[], going: Going, today: Date) {
  const rank = (f: Festival) => {
    const until = daysUntil(f, today);
    if (until === undefined) return Number.MAX_SAFE_INTEGER - 1;
    const end = daysUntil({ ...f, startDate: f.endDate ?? f.startDate }, today)!;
    return end < 0 ? Number.MAX_SAFE_INTEGER : until;
  };
  const mine = festivals
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => going.includes(f.id))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .map(({ f }) => f);
  return { going: mine, others: festivals.filter((f) => !going.includes(f.id)) };
}

/**
 * The festivals the Lineup tab switches between: the ones you're going to,
 * soonest first; every festival when you haven't picked any yet.
 */
export function lineupChoices(festivals: Festival[], going: Going, today: Date) {
  const mine = groupFestivals(festivals, going, today).going;
  return { festivals: mine.length ? mine : festivals, yours: mine.length > 0 };
}
