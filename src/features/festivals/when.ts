import type { Festival } from '../../data/models';

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

/** Whole days from today until the festival starts: 0 on the first day, negative once it's begun. */
export function daysUntil(festival: Festival, today: Date): number | undefined {
  if (!festival.startDate) return undefined;
  return fromIso(festival.startDate) - fromDate(today);
}

/** "In 38 days", "Tomorrow", "Happening now", "Over". Undefined when the festival has no dates. */
export function countdown(festival: Festival, today: Date): string | undefined {
  const until = daysUntil(festival, today);
  if (until === undefined) return undefined;
  if (until > 1) return until < 60 ? `In ${until} days` : `In ${Math.round(until / 30.4)} months`;
  if (until === 1) return 'Tomorrow';
  const end = fromIso(festival.endDate ?? festival.startDate!);
  return fromDate(today) <= end ? 'Happening now' : 'Over';
}

/** The line under an artist at a festival: their set time and/or what the lineup says about their set. */
export function setLine(when: string | undefined, note: string | undefined) {
  return [when, note].filter(Boolean).join(' · ') || undefined;
}
