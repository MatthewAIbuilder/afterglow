import type { Festival } from '../../data/types';
import { isOver } from '../festivals/shelves';
import type { DayRoute, RouteStop } from './route';
import { tn } from '../../i18n';

/**
 * "Your lineup is ready": once set times are out for a festival you're
 * going to, it leads the Festivals tab with your set-to-set route. Pure.
 */

/** How many stops the card previews. */
export const READY_STOPS = 3;

/** The first festival you're going to (soonest first, as given) that isn't over and has set times. */
export function readyFestival(going: readonly Festival[], today: Date): Festival | undefined {
  return going.find((f) => (f.sets?.length ?? 0) > 0 && !isOver(f, today));
}

/** The first day of the route with any sets: its first few stops and how many more. */
export function routePreview(route: readonly DayRoute[] | undefined, max = READY_STOPS): { day: string; stops: RouteStop[]; more: number } | undefined {
  for (const day of route ?? []) {
    const sets = day.stops.filter((s): s is RouteStop => s.kind === 'set');
    if (sets.length) return { day: day.day, stops: sets.slice(0, max), more: Math.max(0, sets.length - max) };
  }
  return undefined;
}

/** "3 sets on Friday", "1 set on Friday", plus "and 4 more days" when there are. */
export function routeSummary(route: readonly DayRoute[] | undefined): string | undefined {
  const days = (route ?? []).filter((d) => d.stops.some((s) => s.kind === 'set'));
  if (!days.length) return undefined;
  const sets = days.reduce((n, d) => n + d.stops.filter((s) => s.kind === 'set').length, 0);
  return days.length === 1
    ? tn(sets, '{n} set over {days} day', '{n} sets over {days} day', { days: days.length })
    : tn(sets, '{n} set over {days} days', '{n} sets over {days} days', { days: days.length });
}
