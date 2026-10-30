import { metersBetween } from './trail';
import { t } from '../../i18n';

/**
 * Find my way back: places you saved (your car, your tent, anywhere), kept
 * only on this phone, and how far and which way they are from you. Pure.
 */
export type SpotKind = 'car' | 'tent' | 'spot';
export type Spot = {
  id: string;
  kind: SpotKind;
  /** Your own words, for a spot ("Gate C", "Our flag"). */
  label?: string;
  lat: number;
  lon: number;
  /** How sure the phone was, in meters. */
  accuracy?: number;
  /** When you saved it (ms). */
  at: number;
};

export const SPOTS_MAX = 8;
export const LABEL_MAX = 40;
/** Walking pace for "8 min walk": a crowd's, not a stroll's. */
export const WALK_M_PER_MIN = 70;
/** Closer than this and you're there. */
export const HERE_M = 15;
/** A spot older than this is probably from another trip. */
export const OLD_AFTER_MS = 14 * 24 * 3600_000;

const KINDS: readonly SpotKind[] = ['car', 'tent', 'spot'];

const okNum = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Saved spots read back from storage, whatever shape they're in. Newest first. */
export function cleanSpots(raw: unknown): Spot[] {
  if (!Array.isArray(raw)) return [];
  const out: Spot[] = [];
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const s = v as Record<string, unknown>;
    if (typeof s.id !== 'string' || !s.id || !KINDS.includes(s.kind as SpotKind)) continue;
    if (!okNum(s.lat, -90, 90) || !okNum(s.lon, -180, 180) || !okNum(s.at, 0, 8.64e15)) continue;
    const label = typeof s.label === 'string' ? s.label.trim().slice(0, LABEL_MAX) : '';
    out.push({
      id: s.id,
      kind: s.kind as SpotKind,
      ...(label ? { label } : {}),
      lat: s.lat,
      lon: s.lon,
      ...(okNum(s.accuracy, 0, 100_000) ? { accuracy: s.accuracy } : {}),
      at: s.at,
    });
  }
  return out.sort((a, b) => b.at - a.at).slice(0, SPOTS_MAX);
}

/**
 * Saves a spot. Your car and your tent are one each (saving again moves it);
 * other spots add up, oldest dropped past `SPOTS_MAX`.
 */
export function saveSpot(spots: readonly Spot[], spot: Spot): Spot[] {
  const rest = spots.filter((s) => s.id !== spot.id && (spot.kind === 'spot' || s.kind !== spot.kind));
  return [spot, ...rest].slice(0, SPOTS_MAX);
}

export const removeSpot = (spots: readonly Spot[], id: string): Spot[] => spots.filter((s) => s.id !== id);

/** Compass bearing from one point to another, 0 to 360 (0 is north). */
export function bearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const f1 = from.lat * rad;
  const f2 = to.lat * rad;
  const dl = (to.lon - from.lon) * rad;
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

/** Where to point the arrow: the spot's bearing turned by which way you face (`heading`, 0 is north). */
export const arrowAngle = (bearingDeg: number, heading?: number) => (((bearingDeg - (heading ?? 0)) % 360) + 360) % 360;

/** "north-east", for when there's no compass (a browser, a phone without one). */
export function compassWord(deg: number): string {
  const words = [t('north'), t('north-east'), t('east'), t('south-east'), t('south'), t('south-west'), t('west'), t('north-west')];
  return words[Math.round(deg / 45) % 8];
}

export type Way = { meters: number; minutes: number; bearing: number; here: boolean };

/** How far, how long a walk and which way from where you are. */
export function wayTo(from: { lat: number; lon: number }, spot: Spot): Way {
  const meters = metersBetween(from, spot);
  return { meters, minutes: Math.max(1, Math.round(meters / WALK_M_PER_MIN)), bearing: bearing(from, spot), here: meters <= Math.max(HERE_M, spot.accuracy ?? 0) };
}

/** The spot's name: your words, or what it is. */
export function spotName(s: Pick<Spot, 'kind' | 'label'>): string {
  if (s.label) return s.label;
  return s.kind === 'car' ? t('My car') : s.kind === 'tent' ? t('My tent') : t('Saved spot');
}

/** Directions in the phone's maps app (walking), for when you'd rather follow a map. */
export function mapsLink(s: Pick<Spot, 'lat' | 'lon'>, apple: boolean): string {
  const ll = `${s.lat.toFixed(6)},${s.lon.toFixed(6)}`;
  return apple ? `https://maps.apple.com/?daddr=${ll}&dirflg=w` : `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=walking`;
}
