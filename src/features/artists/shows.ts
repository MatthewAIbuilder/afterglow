import type { Show } from '../../data/models';
import { months, t, weekdays } from '../../i18n';

/**
 * Words for an artist's club shows (from the nightly EDMTrain feed) on their
 * page. Pure.
 */

/** Shows listed before "See all". */
export const SHOWS_SHOWN = 5;

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const pad = (n: number) => String(n).padStart(2, '0');
/** The phone's own day, "YYYY-MM-DD" (shows are listed by the venue's local day). */
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const parts = (day: string) => {
  const date = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))));
  return { month: date.getUTCMonth(), dom: date.getUTCDate(), wd: date.getUTCDay() };
};

/** The calendar block: { month: "OCT", day: "18", weekday: "Sat" }. */
export function showDateBlock(day: string): { month: string; day: string; weekday: string } {
  const { month, dom, wd } = parts(day);
  return { month: months(true)[month].toUpperCase(), day: String(dom), weekday: capital(weekdays(true)[wd]) };
}

/** "Saturday 18 October", for screen readers. */
export const showDateSpoken = (day: string) => {
  const { month, dom, wd } = parts(day);
  return capital(t('{weekday} {day} {month}', { weekday: weekdays()[wd], day: dom, month: months()[month] }));
};

/** The show's own name when it has one, else the venue. */
export const showTitle = (show: Show) => show.name ?? show.venue;

/** Where: "Echostage, Washington, DC" under a named event, or just the town under a venue. */
export const showWhere = (show: Show) => (show.name ? [show.venue, show.location] : [show.location]).filter(Boolean).join(', ');

/** "with Fred again.. and Skrillex", "with A, B and 2 more"; undefined when no one else on Afterglow plays it. */
export function withLine(names: readonly string[], most = 2): string | undefined {
  if (!names.length) return undefined;
  if (names.length <= most + 1) {
    return names.length === 1 ? t('with {name}', { name: names[0] }) : t('with {names} and {last}', { names: names.slice(0, -1).join(', '), last: names[names.length - 1] });
  }
  return t('with {names} and {n} more', { names: names.slice(0, most).join(', '), n: names.length - most });
}

/** What a screen reader says for a show row. */
export function showLabel(show: Show, others: readonly string[]): string {
  const where = showWhere(show);
  const line = withLine(others);
  const w = line && capital(line);
  return [`${showTitle(show)}, ${showDateSpoken(show.date)}`, where, w].filter(Boolean).join('. ') + t('. Opens the event page on EDMTrain.');
}
