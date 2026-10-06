import type { Artist, Festival } from '../../data/models';
import { t } from '../../i18n';
import { toMinutes } from './plan';
import type { DayRoute, RouteStop } from './route';

/** Crewmates who starred an artist at this festival (first names; never you). */
export type StarsFor = (artistId: string) => string[];

/** A set on your route with crewmates who starred it too: where you'll meet. */
export type MeetUp = { stop: RouteStop; names: string[] };

/** A crewmate who'll be somewhere else during one of your sets: who, at what, where. */
export type Elsewhere = { name: string; artist: Artist; stageId: string; start: number; end: number };

/** "Maya", "Maya and Sam", "Maya, Sam and Jo", "Maya, Sam and 2 more". */
export function namesLine(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return t('{a} and {b}', { a: names[0], b: names[1] });
  if (names.length === 3) return t('{a}, {b} and {c}', { a: names[0], b: names[1], c: names[2] });
  return t('{a}, {b} and {n} more', { a: names[0], b: names[1], n: names.length - 2 });
}

/**
 * The sets on a day's route your crewmates starred too, in the order you'll
 * be there: the moments you'll be together. Pure.
 */
export function meetUps(route: DayRoute, starsFor: StarsFor): MeetUp[] {
  return route.stops
    .filter((s): s is RouteStop => s.kind === 'set')
    .map((stop) => ({ stop, names: starsFor(stop.artist.id) }))
    .filter((m) => m.names.length > 0);
}

/**
 * While you're at a set, which crewmates starred something else on at the
 * same time (and not this one): so you know who's off where, and can find
 * them after. A name once, at the set that overlaps your stop the most. Pure.
 */
export function elsewhereDuring(festival: Pick<Festival, 'sets'>, artistOf: (id: string) => Artist | undefined, stop: RouteStop, starsFor: StarsFor): Elsewhere[] {
  const here = new Set(starsFor(stop.artist.id));
  const best = new Map<string, Elsewhere & { overlap: number }>();
  for (const set of festival.sets ?? []) {
    if (set.day !== stop.set.day || set.artistId === stop.artist.id) continue;
    const start = toMinutes(set.start);
    const end = toMinutes(set.end) <= start ? toMinutes(set.end) + 24 * 60 : toMinutes(set.end);
    const overlap = Math.min(end, stop.to) - Math.max(start, stop.from);
    if (overlap <= 0) continue;
    const artist = artistOf(set.artistId);
    if (!artist) continue;
    for (const name of starsFor(set.artistId)) {
      if (here.has(name)) continue;
      const was = best.get(name);
      if (!was || overlap > was.overlap) best.set(name, { name, artist, stageId: set.stageId, start, end, overlap });
    }
  }
  return [...best.values()].sort((a, b) => a.start - b.start || a.name.localeCompare(b.name)).map(({ overlap: _overlap, ...e }) => e);
}
