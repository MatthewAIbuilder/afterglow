import type { Show } from '../../data/models';
import { showDateSpoken, showTitle } from '../artists/shows';
import type { Point } from '../festivals/near';
import { type MapPoint, type Marker, project } from './map';

/**
 * An artist's tour on the map, pure: their festivals (past ones too) and
 * their upcoming club shows (from the nightly EDMTrain feed), each a stop,
 * in date order for the line that joins them and the cards along the bottom.
 */

/** A club show with a place, as a small light on the map. */
export type ShowPin = { show: Show; point: Point; at: MapPoint };

export type TourStop =
  | { kind: 'festival'; id: string; at: MapPoint; marker: Marker }
  | { kind: 'show'; id: string; at: MapPoint; pin: ShowPin };

/** Shows from `today` ("YYYY-MM-DD") on that have a place, soonest first. */
export function showPins(shows: readonly Show[], today: string): ShowPin[] {
  const pins: ShowPin[] = [];
  for (const show of shows) {
    if (show.date < today || !show.place) continue;
    const point = { lat: show.place.lat, lon: show.place.lon };
    pins.push({ show, point, at: project(point) });
  }
  return pins.sort((a, b) => a.show.date.localeCompare(b.show.date) || a.show.id.localeCompare(b.show.id));
}

export const festivalStop = (marker: Marker): TourStop => ({ kind: 'festival', id: marker.festival.id, at: marker.at, marker });
export const showStop = (pin: ShowPin): TourStop => ({ kind: 'show', id: pin.show.id, at: pin.at, pin });

/** The day a stop starts ("9999" when a festival has no dates yet, so it goes last). */
export const stopDate = (s: TourStop) => (s.kind === 'festival' ? (s.marker.festival.startDate ?? '9999') : s.pin.show.date);

/**
 * Every stop in date order (undated festivals last); on the same day a
 * festival comes before a show. The order the tour line and the cards follow.
 */
export function tourStops(festivals: readonly Marker[], shows: readonly ShowPin[]): TourStop[] {
  const stops = [...festivals.map(festivalStop), ...shows.map(showStop)];
  return stops
    .map((s, i) => ({ s, i }))
    .sort((a, b) => stopDate(a.s).localeCompare(stopDate(b.s)) || (a.s.kind === b.s.kind ? a.i - b.i : a.s.kind === 'festival' ? -1 : 1))
    .map(({ s }) => s);
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The tour's subtitle, short enough for one line: "2 festivals · 3 shows", "2 festivals, in date order", "1 show". */
export function tourLine(festivals: number, shows: number): string {
  if (festivals + shows === 0) return 'No festivals or shows with a place yet';
  if (festivals && shows) return `${count(festivals, 'festival', 'festivals')} · ${count(shows, 'show', 'shows')}`;
  const n = festivals || shows;
  const what = festivals ? count(n, 'festival', 'festivals') : count(n, 'show', 'shows');
  return n > 1 ? `${what}, in date order` : what;
}

/** What a screen reader says for a show's light: "Show: Club Space, Saturday 18 October, Miami, FL." */
export function showPinLabel(show: Show): string {
  const where = show.name ? [show.venue, show.location] : [show.location];
  return [`Show: ${showTitle(show)}`, showDateSpoken(show.date), ...where.filter(Boolean)].join(', ') + '.';
}
