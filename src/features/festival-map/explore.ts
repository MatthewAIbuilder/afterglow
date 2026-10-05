import type { Festival } from '../../data/models';
import { searchFestivals } from '../festivals/search';
import { whenRank } from '../festivals/shelves';
import type { MapPoint, Marker, Region } from './map';

/**
 * Getting around the festival map. Pure.
 *
 * Festival places are often a city, or a venue several festivals share, so
 * lights can sit on the very same spot: zoomed in to a city they fan out in
 * a small ring, each its own light. The cards under the map follow what's
 * in view. Search and "when" narrow the map down.
 */

/** Festivals closer than this (map units, about 3 km) share a spot. */
export const SAME_SPOT = 0.03;
/** Zoomed in further than this (degrees across), festivals sharing a spot fan out. */
export const SPREAD_DELTA = 1.5;
/** How far from the spot a fanned-out light sits, in screen pixels (more of them, a wider ring). */
export const SPREAD_PX = 42;

const near = (a: MapPoint, b: MapPoint) => Math.hypot(a.x - b.x, a.y - b.y) < SAME_SPOT;

/** All of them at one spot: zooming in won't split them, they fan out instead. */
export const sameSpot = (markers: readonly Marker[]) => markers.length > 1 && markers.every((m) => near(m.at, markers[0].at));

/**
 * Festivals sharing a spot, fanned out in a ring around it once you're zoomed
 * in past `SPREAD_DELTA`, in date order from the top, clockwise, so the same
 * festival is always in the same place. `pxPerUnit` is the map's scale.
 * Others are untouched; `point` (the real place) never changes.
 */
export function spreadMarkers(markers: readonly Marker[], region: Pick<Region, 'longitudeDelta'>, pxPerUnit: number): Marker[] {
  if (region.longitudeDelta >= SPREAD_DELTA) return [...markers];
  const groups: Marker[][] = [];
  for (const m of markers) {
    const g = groups.find((x) => near(x[0].at, m.at));
    if (g) g.push(m);
    else groups.push([m]);
  }
  const moved = new Map<string, MapPoint>();
  for (const g of groups) {
    if (g.length < 2) continue;
    const ordered = [...g].sort((a, b) => (a.festival.startDate ?? '9999').localeCompare(b.festival.startDate ?? '9999') || a.festival.id.localeCompare(b.festival.id));
    const center = { x: ordered.reduce((s, m) => s + m.at.x, 0) / g.length, y: ordered.reduce((s, m) => s + m.at.y, 0) / g.length };
    const r = (SPREAD_PX * Math.max(1, g.length / 6)) / Math.max(1e-6, pxPerUnit);
    ordered.forEach((m, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / g.length;
      moved.set(m.festival.id, { x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) });
    });
  }
  return markers.map((m) => {
    const at = moved.get(m.festival.id);
    return at ? { ...m, at } : m;
  });
}

/** When: any time, starting in the next month, or in the next three. */
export type WhenFilter = 'any' | 'month' | 'season';
export const WHEN_LABEL: Record<WhenFilter, string> = { any: 'Any time', month: 'Next 30 days', season: 'Next 3 months' };
const WHEN_DAYS: Record<Exclude<WhenFilter, 'any'>, number> = { month: 30, season: 92 };

/** Festivals on now or starting within the window (undated ones only for "any time"). */
export function filterWhen(markers: readonly Marker[], when: WhenFilter, today: Date): Marker[] {
  if (when === 'any') return [...markers];
  return markers.filter((m) => whenRank(m.festival, today) <= WHEN_DAYS[when]);
}

/** Festivals whose name or place matches what was typed, in the map's order. Nothing typed: all of them. */
export function searchMarkers(markers: readonly Marker[], query: string): Marker[] {
  if (!query.trim()) return [...markers];
  const found = new Set<Festival>(searchFestivals(markers.map((m) => m.festival), query));
  return markers.filter((m) => found.has(m.festival));
}

/** The festivals inside a region (the part of the map you can see), soonest first. */
export function inView(markers: readonly Marker[], region: Region, today: Date): Marker[] {
  const halfLat = region.latitudeDelta / 2;
  const halfLon = region.longitudeDelta / 2;
  const lonOff = (lon: number) => ((((lon - region.longitude) % 360) + 540) % 360) - 180;
  return markers
    .filter((m) => Math.abs(m.point.lat - region.latitude) <= halfLat && Math.abs(lonOff(m.point.lon)) <= halfLon)
    .sort((a, b) => whenRank(a.festival, today) - whenRank(b.festival, today) || a.festival.name.localeCompare(b.festival.name));
}

/** "12 festivals here", "1 festival here", "Nothing here". */
export function inViewLine(n: number): string {
  return n === 0 ? 'No festivals here' : n === 1 ? '1 festival here' : `${n} festivals here`;
}

/** How far to zoom so a group sharing a spot fans out (a little past the threshold). */
export const SPREAD_ZOOM = SPREAD_DELTA * 0.5;
