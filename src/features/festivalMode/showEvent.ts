import type { Festival, Show } from '../../data/models';
import { nightStart } from '../care/care';
import { SHOW_PREFIX } from '../community/clips';
import { goingShowOf, type GoingShow } from '../festivals/goingShows';
import { runLabel } from '../festivals/weekend';

/**
 * One-night shows as festival-mode events, pure. A show you're going to
 * becomes a one-night "festival" for the night: its bill is the lineup, its
 * day the only day, no stages or set times. Festival mode, Tonight, the
 * camera, crews and Discover then work for it as for a festival. Its id is
 * `show:<show id>`, the same key crowd videos tagged with the show are filed
 * under (`community/clips.ts`), so the videos filmed there find it.
 */

/** "show:edm-123456". */
export const showEventId = (showId: string) => `${SHOW_PREFIX}${showId}`;

/** The show behind an event id, or undefined for a festival. */
export const showIdOf = (festivalId: string | undefined): string | undefined =>
  festivalId?.startsWith(SHOW_PREFIX) ? festivalId.slice(SHOW_PREFIX.length) || undefined : undefined;

/** Whether this is a one-night show rather than a festival. */
export const isShowEvent = (festival: { id: string } | undefined) => !!festival && !!showIdOf(festival.id);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "2026-10-09" -> "Friday" (English, like a lineup's days; shown through `t`). */
export function weekdayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? 'Friday';
}

/**
 * A show as a one-night event. `live` is the show from tonight's catalogue
 * when it's still there (venue, map point, tickets and the latest bill);
 * without it, the copy kept when you said you're going (works with no signal).
 */
export function showAsEvent(show: GoingShow, live?: Show): Festival {
  const bill = live?.artistIds.length ? live.artistIds : show.artistIds;
  return {
    id: showEventId(show.id),
    name: show.title || live?.venue || show.where,
    dates: runLabel({ start: show.date, end: show.date }),
    location: [live?.name && live.venue !== live.name ? live.venue : undefined, show.where || live?.location].filter(Boolean).join(', '),
    ...(live?.place ? { place: live.place } : {}),
    ...(live?.link ? { links: { tickets: live.link } } : {}),
    lineup: [...bill],
    days: [weekdayOf(show.date)],
    stages: [],
    startDate: show.date,
    endDate: show.date,
    ...(live?.organizer ? { organizer: live.organizer } : {}),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Tonight's date as a show's day: nights run noon to noon, so 1 AM is still the night before. */
export function nightDate(now: Date): string {
  const d = new Date(nightStart(now.getTime()));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The show you're going to tonight, as an event (from noon on its day to
 * noon the next), with its night. Undefined when there's none tonight.
 */
export function showTonight(shows: readonly GoingShow[], liveShows: readonly Show[], now: Date): { festival: Festival; night: string } | undefined {
  const day = nightDate(now);
  const show = shows.find((s) => s.date === day);
  if (!show) return undefined;
  return { festival: showAsEvent(show, liveShows.find((s) => s.id === show.id)), night: weekdayOf(show.date) };
}

/** Every show you're going to that hasn't passed, as events (for a festival-mode test and lookups). */
export function upcomingShowEvents(shows: readonly GoingShow[], liveShows: readonly Show[], today: Date): Festival[] {
  const day = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return shows
    .filter((s) => s.date >= day)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => showAsEvent(s, liveShows.find((l) => l.id === s.id)));
}

/**
 * Finding an event by id: a festival, or a show (one you're going to, else
 * one in the catalogue). For crews and festival mode, where an id may be a show.
 */
export function eventById(
  id: string,
  o: { festival: (id: string) => Festival | undefined; shows: readonly GoingShow[]; liveShows: readonly Show[] },
): Festival | undefined {
  const showId = showIdOf(id);
  if (!showId) return o.festival(id);
  const live = o.liveShows.find((s) => s.id === showId);
  const mine = o.shows.find((s) => s.id === showId);
  if (mine) return showAsEvent(mine, live);
  if (!live) return undefined;
  return showAsEvent(goingShowOf(live), live);
}

/** Where an event's page is: the show page for a show, else the festival page. */
export const eventPath = (festival: { id: string }) => {
  const showId = showIdOf(festival.id);
  return showId ? `/show/${showId}` : `/festival/${festival.id}`;
};
