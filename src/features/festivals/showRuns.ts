import type { Show } from '../../data/models';
import { addDays } from './showsForYou';
import { normalize } from './search';

/**
 * A festival that EDMTrain lists as shows: it lists each day of an event
 * separately, and a weekend that isn't flagged as a festival arrives as one
 * show a day. Pure. Days of one event share its own name and venue and follow
 * one another; a club's nights (no name of their own) never join up.
 */
const runKey = (s: Show) => (s.name ? `${normalize(s.name)}|${normalize(s.venue)}|${normalize(s.location)}` : undefined);

/** Every day of the event `show` belongs to, soonest first (just `show` for a one-night show). */
export function showRun(shows: readonly Show[], show: Show): Show[] {
  const key = runKey(show);
  if (!key) return [show];
  const byDay = new Map<string, Show>();
  for (const s of shows) if (runKey(s) === key && !byDay.has(s.date)) byDay.set(s.date, s);
  byDay.set(show.date, show);
  let first = show.date;
  while (byDay.has(addDays(first, -1))) first = addDays(first, -1);
  const run: Show[] = [];
  for (let d = first; byDay.has(d); d = addDays(d, 1)) run.push(byDay.get(d)!);
  return run;
}
