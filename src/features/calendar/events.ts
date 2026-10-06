import type { Festival, Show } from '../../data/models';

/**
 * A festival as a calendar event: all day, from its first to its last day
 * (the weekend you're going to, when the festival is given as it is for
 * you), at its location, with a link back to it. Pure; the phone's own
 * calendar screen or a downloaded .ics file do the adding.
 */
export type CalendarEvent = {
  title: string;
  /** Local calendar days, "YYYY-MM-DD", both included. */
  startDay: string;
  endDay: string;
  location: string;
  notes: string;
  url: string;
};

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Only for festivals with real dates. */
export function festivalEvent(festival: Festival, webUrl: string): CalendarEvent | undefined {
  const { startDate, endDate } = festival;
  if (!startDate || !DAY.test(startDate)) return undefined;
  const end = endDate && DAY.test(endDate) && endDate >= startDate ? endDate : startDate;
  const url = `${webUrl}/festival/${festival.id}`;
  return {
    title: festival.name,
    startDay: startDate,
    endDay: end,
    location: festival.location ?? '',
    notes: `Your lineup and plan: ${url}`,
    url,
  };
}

/** A club show as a calendar event: its day, at the venue, with who's on and a link back to it. */
export function showEvent(show: Show, webUrl: string, artistNames: readonly string[]): CalendarEvent | undefined {
  if (!DAY.test(show.date)) return undefined;
  const url = `${webUrl}/show/${show.id}`;
  const title = show.name ?? (artistNames.length ? `${artistNames.slice(0, 2).join(' & ')} at ${show.venue}` : show.venue);
  const lineup = artistNames.length ? `With ${artistNames.join(', ')}. ` : '';
  return {
    title,
    startDay: show.date,
    endDay: show.date,
    location: [show.venue, show.location].filter(Boolean).join(', '),
    notes: `${lineup}Tickets: ${show.link}\nOn Afterglow: ${url}`,
    url,
  };
}

/** A local calendar day as a Date at midnight (for the phone's calendar screen). */
export function localDay(day: string): Date {
  const [, y, m, d] = DAY.exec(day)!;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

/** The day after, "YYYY-MM-DD" (an all-day event ends the morning after its last day). */
export function nextDay(day: string): string {
  const d = localDay(day);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/** Text in an .ics field: backslashes, commas, semicolons and line breaks escaped. */
export const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');

/** The event as an .ics file (for the website, where there's no calendar screen to open). */
export function icsFor(e: CalendarEvent, now: Date, uidSeed: string): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Afterglow//Festival calendar//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uidSeed}@afterglowmusic.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${e.startDay.replace(/-/g, '')}`,
    `DTEND;VALUE=DATE:${nextDay(e.endDay)}`,
    `SUMMARY:${icsText(e.title)}`,
    ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
    `DESCRIPTION:${icsText(e.notes)}`,
    `URL:${e.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** A safe file name: "edc-orlando-2026.ics". */
export const icsFileName = (title: string) => `${title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'festival'}.ics`;
