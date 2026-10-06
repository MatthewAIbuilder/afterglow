import type { Festival } from '../../data/models';
import { bySoonest, isOver } from './shelves';
import { LOCALE, t } from '../../i18n';

/**
 * Festivals near you. Pure: where you are comes in as a rough point (rounded
 * on the phone, never sent anywhere), where each festival is from its venue's
 * coordinates or a place the phone looked up, and this sorts and labels them.
 */
export type Point = { lat: number; lon: number };

/** "Near you" reaches this far (about 300 miles: a drive or a short flight). */
export const NEAR_KM = 500;
/** At most this many in the Near you section. */
export const NEAR_MAX = 6;

const EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Straight-line distance between two points, in km. */
export function distanceKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A real point on the map (not 0,0, which is what a failed lookup often gives). */
export function isPoint(p: unknown): p is Point {
  if (!p || typeof p !== 'object') return false;
  const { lat, lon } = p as Point;
  return typeof lat === 'number' && typeof lon === 'number' && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0);
}

/** Where you are, rounded to about a kilometre: enough for distances, no more. */
export const roughly = (p: Point): Point => ({ lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100 });

/** Festivals within reach that aren't over, nearest first (soonest breaks ties). */
export function nearYou(
  festivals: readonly Festival[],
  here: Point,
  placeOf: (f: Festival) => Point | undefined,
  today: Date,
  opts: { maxKm?: number; max?: number } = {},
): { festival: Festival; km: number }[] {
  const maxKm = opts.maxKm ?? NEAR_KM;
  const soonest = bySoonest(festivals, today);
  const order = new Map(soonest.map((f, i) => [f.id, i]));
  return festivals
    .filter((f) => !isOver(f, today))
    .flatMap((f) => {
      const p = placeOf(f);
      if (!p) return [];
      const km = distanceKm(here, p);
      return km <= maxKm ? [{ festival: f, km }] : [];
    })
    .sort((a, b) => Math.round(a.km / 10) - Math.round(b.km / 10) || order.get(a.festival.id)! - order.get(b.festival.id)!)
    .slice(0, opts.max ?? NEAR_MAX);
}

export type Units = 'mi' | 'km';

/** Miles where people drive in miles (US, UK, Liberia, Myanmar), else km. */
export function unitsFor(locale: string | undefined): Units {
  const region = (locale ?? '').split(/[-_]/)[1]?.toUpperCase();
  return region && ['US', 'GB', 'LR', 'MM'].includes(region) ? 'mi' : 'km';
}

/** "12 mi", "Under 1 km", "1,240 mi". */
export function distanceShort(km: number, units: Units): string {
  const n = units === 'mi' ? km / 1.609344 : km;
  if (n < 1) return t('Under 1 {units}', { units });
  const rounded = n < 100 ? Math.round(n) : Math.round(n / 10) * 10;
  return `${rounded.toLocaleString(LOCALE)} ${units}`;
}

/** "12 mi away", "Under 1 km away", "1,240 mi away". */
export const distanceLabel = (km: number, units: Units) => t('{distance} away', { distance: distanceShort(km, units) });

/** The heading's reach: "Within 300 mi" / "Within 500 km". */
export function reachLabel(units: Units, maxKm = NEAR_KM): string {
  const n = units === 'mi' ? Math.round(maxKm / 1.609344 / 50) * 50 : maxKm;
  return t('Within {n} {units}', { n, units });
}

/** A place name to look up for a festival without coordinates: its location text, tidied. */
export function lookupText(f: Pick<Festival, 'location'>): string | undefined {
  const t = f.location.trim().replace(/\s+/g, ' ');
  return t.length >= 3 ? t : undefined;
}
