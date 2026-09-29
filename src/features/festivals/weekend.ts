import type { Festival } from '../../data/models';

/**
 * Festivals run over several weekends (ACL, Coachella), seen from the one
 * you're going to. Pure. A weekend is 1-based; undefined means every weekend
 * (not chosen, or going to all of them).
 */

/** Does this artist play that weekend? Artists without a weekend play them all. */
export function playsWeekend(festival: Festival, artistId: string, weekend: number | undefined) {
  if (!weekend) return true;
  const only = festival.artistWeekends?.[artistId];
  return !only || only === weekend;
}

/** A weekend choice that makes sense for this festival, or undefined. */
export function validWeekend(festival: Festival, weekend: number | undefined) {
  const count = festival.weekends?.length ?? 0;
  return weekend && count > 1 && weekend >= 1 && weekend <= count ? weekend : undefined;
}

/**
 * The festival as it is for someone going to one weekend: only the acts on
 * that weekend, and only that weekend's dates (so the countdown, reminders
 * and plan follow it). Unchanged without a weekend choice.
 */
export function forWeekend(festival: Festival, weekend: number | undefined): Festival {
  const w = validWeekend(festival, weekend);
  if (!w) return festival;
  const run = festival.weekends![w - 1];
  const lineup = festival.lineup.filter((id) => playsWeekend(festival, id, w));
  const keep = new Set(lineup);
  const only = <T,>(record: Record<string, T> | undefined) =>
    record ? Object.fromEntries(Object.entries(record).filter(([id]) => keep.has(id))) : undefined;
  const next: Festival = { ...festival, lineup, startDate: run.start, endDate: run.end };
  delete next.weekends;
  if (festival.notes) next.notes = only(festival.notes);
  if (festival.artistDays) next.artistDays = only(festival.artistDays);
  if (festival.sets) next.sets = festival.sets.filter((s) => keep.has(s.artistId));
  return next;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 9 to 11", or "Oct 30 to Nov 1" across months, from a weekend's first and last day. */
export function runLabel(run: { start: string; end: string }) {
  const [, m1, d1] = run.start.split('-').map(Number);
  const [, m2, d2] = run.end.split('-').map(Number);
  if (run.start === run.end) return `${MONTHS[m1 - 1]} ${d1}`;
  return m1 === m2 ? `${MONTHS[m1 - 1]} ${d1} to ${d2}` : `${MONTHS[m1 - 1]} ${d1} to ${MONTHS[m2 - 1]} ${d2}`;
}
