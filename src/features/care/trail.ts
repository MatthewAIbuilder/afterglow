import type { Festival } from '../../data/models';
import { isOn, tonightFestival } from '../tonight/tonight';
import { runsOf } from '../festivals/when';

/**
 * Your festival trail: where you walked on a festival day, drawn on a map
 * (the user, 2026-10-18: "automatically tracked if it's festival day.
 * Otherwise the feature doesn't even matter day to day"). Recorded by the
 * phone only on the days a festival you're going to is on, kept only on the
 * phone, never sent anywhere. Pure: the filtering of what the phone reports,
 * the numbers, the days, and when recording is on.
 */

/** One place on the trail: when (ms), latitude, longitude (5 decimals, about a metre). */
export type TrailPoint = readonly [at: number, lat: number, lon: number];

/** Every festival's trail, by festival id. */
export type Trails = Record<string, TrailPoint[]>;

/** What the phone reports for one position. */
export type Fix = { at: number; lat: number; lon: number; accuracy?: number | null };

/** Positions less accurate than this (metres) are left out: they draw wild lines. */
export const MAX_ACCURACY_M = 60;
/** Closer than this (metres) to the last point: standing still, not a new point. */
export const MIN_STEP_M = 12;
/** Faster than this (metres a second, about 54 km/h) from the last point: a jump, not walking. */
export const MAX_SPEED_MS = 15;
/** A festival keeps at most this many points; past it, every other point is dropped (it stays the same shape). */
export const MAX_POINTS = 4000;
/** Stops longer than this many minutes aren't "on the move". */
const MOVING_GAP_MIN = 10;

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Metres between two places (haversine). */
export function metersBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const five = (n: number) => Math.round(n * 1e5) / 1e5;
const at = (p: TrailPoint) => ({ lat: p[1], lon: p[2] });

/**
 * A trail with what the phone just reported added: only good positions (accurate enough, a real step
 * from the last point, not a jump), oldest first, never out of order, capped at `MAX_POINTS`. Pure.
 */
export function addFixes(trail: readonly TrailPoint[], fixes: readonly Fix[]): TrailPoint[] {
  let out = [...trail];
  for (const f of [...fixes].sort((a, b) => a.at - b.at)) {
    if (![f.at, f.lat, f.lon].every(Number.isFinite) || Math.abs(f.lat) > 90 || Math.abs(f.lon) > 180) continue;
    if (f.accuracy != null && (f.accuracy < 0 || f.accuracy > MAX_ACCURACY_M)) continue;
    const p: TrailPoint = [Math.round(f.at), five(f.lat), five(f.lon)];
    const last = out[out.length - 1];
    if (last) {
      if (p[0] <= last[0]) continue;
      const d = metersBetween(at(last), at(p));
      if (d < MIN_STEP_M) continue;
      if (d / Math.max(1, (p[0] - last[0]) / 1000) > MAX_SPEED_MS) continue;
    }
    out.push(p);
  }
  if (out.length > MAX_POINTS) out = out.filter((_, i) => i % 2 === 0 || i === out.length - 1);
  return out;
}

/** Saved trails read back: only well-formed points, in time order. */
export function cleanTrails(raw: unknown): Trails {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Trails = {};
  for (const [id, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!id || !Array.isArray(list)) continue;
    const pts = list
      .filter((p): p is number[] => Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every((n) => typeof n === 'number' && Number.isFinite(n)))
      .map((p): TrailPoint => [p[0], p[1], p[2]])
      .sort((a, b) => a[0] - b[0]);
    if (pts.length) out[id] = pts;
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** The festival day a moment belongs to: before 7 AM counts as the day before (like set times). */
export function dayOf(ms: number): string {
  const d = new Date(ms);
  if (d.getHours() < 7) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** One festival day's walk. */
export type TrailDay = { day: string; points: TrailPoint[] };

/** A trail split into festival days, oldest first. */
export function daysOf(trail: readonly TrailPoint[]): TrailDay[] {
  const by = new Map<string, TrailPoint[]>();
  for (const p of trail) {
    const day = dayOf(p[0]);
    by.set(day, [...(by.get(day) ?? []), p]);
  }
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, points]) => ({ day, points }));
}

export type TrailStats = {
  /** Walked, in metres. */
  meters: number;
  /** First to last point, in ms. */
  spanMs: number;
  /** Time actually on the move, in ms (gaps of more than ten minutes are standing still). */
  movingMs: number;
};

export function trailStats(points: readonly TrailPoint[]): TrailStats {
  let meters = 0;
  let movingMs = 0;
  for (let i = 1; i < points.length; i++) {
    meters += metersBetween(at(points[i - 1]), at(points[i]));
    const gap = points[i][0] - points[i - 1][0];
    if (gap <= MOVING_GAP_MIN * 60_000) movingMs += gap;
  }
  return { meters, spanMs: points.length > 1 ? points[points.length - 1][0] - points[0][0] : 0, movingMs };
}

/** "1.2 km" or "3.4 mi", or metres under a tenth of a mile; `miles` for the phone's units. */
export function distanceText(meters: number, miles: boolean): string {
  if (miles) {
    const mi = meters / 1609.344;
    return mi < 0.1 ? `${Math.round(meters * 3.28084)} ft` : `${mi.toFixed(mi < 10 ? 1 : 0)} mi`;
  }
  return meters < 950 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(meters < 9950 ? 1 : 0)} km`;
}

/** "5 h 20 min" or "40 min". */
export function durationText(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${Math.max(0, min)} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

/**
 * Where the map looks: the box around every point, a little padded (never
 * tighter than ~150 m across, so a short walk isn't zoomed to the street). Pure.
 */
export function boxOf(points: readonly TrailPoint[]) {
  const lats = points.map((p) => p[1]);
  const lons = points.map((p) => p[2]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const MIN = 0.0014;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(MIN, (maxLat - minLat) * 1.5),
    longitudeDelta: Math.max(MIN, (maxLon - minLon) * 1.5),
  };
}

// --- When recording is on ---

/** Recording stops this hour of the morning after a festival's last day (nights run past midnight). */
const STOP_HOUR = 7;

/**
 * The festival whose day it is for you: one you're going to that's on now.
 * Recording only ever runs for it. Undefined on every other day.
 */
export function trailFestival(festivals: readonly Festival[], going: readonly string[], now: Date): Festival | undefined {
  return tonightFestival(festivals, going, now)?.festival;
}

/**
 * When recording stops by itself for this festival, as ms: the morning after the last day of the run that's
 * on, at 7 AM. Undefined when it isn't on.
 */
export function trailUntil(festival: Festival, now: Date): number | undefined {
  if (!isOn(festival, now)) return undefined;
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const todayOrYesterday = now.getHours() < STOP_HOUR ? dayOf(now.getTime()) : today;
  const run = runsOf(festival).find((r) => r.start <= todayOrYesterday && todayOrYesterday <= r.end);
  if (!run) return undefined;
  const [y, m, d] = run.end.split('-').map(Number);
  return new Date(y, m - 1, d + 1, STOP_HOUR).getTime();
}

/** How you've chosen to have it: asked (not yet decided), on, or off. */
export type TrailMode = 'ask' | 'on' | 'off';

export type TrailPrefs = {
  mode: TrailMode;
  /** The festival day (`festivalId:day`) you were last asked about, so it asks once a day at most. */
  askedFor?: string;
};

export function cleanPrefs(raw: unknown): TrailPrefs {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    mode: o.mode === 'on' || o.mode === 'off' ? o.mode : 'ask',
    ...(typeof o.askedFor === 'string' && o.askedFor.length < 200 ? { askedFor: o.askedFor } : {}),
  };
}

/** The key for asking once per festival day. */
export const askKey = (festivalId: string, now: Date) => `${festivalId}:${dayOf(now.getTime())}`;

/**
 * What the keeper should do now: record (it's a festival day and you said yes), ask (a festival day and you
 * haven't decided, once a day), or stop (any other day, or you said no). Pure.
 */
export function trailPlan(prefs: TrailPrefs, festival: Festival | undefined, now: Date): { do: 'record'; festival: Festival; until: number } | { do: 'ask'; festival: Festival } | { do: 'stop' } {
  if (!festival) return { do: 'stop' };
  if (prefs.mode === 'on') {
    const until = trailUntil(festival, now);
    return until ? { do: 'record', festival, until } : { do: 'stop' };
  }
  if (prefs.mode === 'ask' && prefs.askedFor !== askKey(festival.id, now)) return { do: 'ask', festival };
  return { do: 'stop' };
}
