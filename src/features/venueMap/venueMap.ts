import type { Festival } from '../../data/models';
import { metersBetween, type TrailPoint } from '../care/trail';
import { WALK_M_PER_MIN } from '../care/spots';
import { toMinutes } from '../plan/plan';
import { dayStarts } from '../notifications/setReminders';
import { t } from '../../i18n';

/**
 * Festival maps: the festival's own map picture (uploaded in HQ by someone
 * with the rights to it), pinned to the ground with three points whose real
 * coordinates are known, and markers on it. Pure: reading one, turning a GPS
 * position into a spot on the picture and back, distances and walks between
 * markers, and the sets your festival trail says you stood at.
 */
export const PIN_KINDS = ['stage', 'water', 'medical', 'toilets', 'entrance', 'food', 'lockers', 'charging', 'info', 'camp'] as const;
export type PinKind = (typeof PIN_KINDS)[number];

export const PIN_LABEL: Record<PinKind, string> = {
  stage: t('Stage'),
  water: t('Water'),
  medical: t('Medical'),
  toilets: t('Toilets'),
  entrance: t('Entrance'),
  food: t('Food'),
  lockers: t('Lockers'),
  charging: t('Charging'),
  info: t('Info'),
  camp: t('Camping'),
};

/** A spot on the picture (pixels, from the top left) and where it really is. */
export type Anchor = { x: number; y: number; lat: number; lon: number };
export type Pin = { id: string; kind: PinKind; label: string; x: number; y: number; stageId?: string };
export type VenueMap = { festivalId: string; image: string; width: number; height: number; anchors: Anchor[]; pins: Pin[]; updatedAt?: string };

export const PINS_MAX = 200;
export const LABEL_MAX = 40;

const num = (v: unknown, lo = -Infinity, hi = Infinity): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** A map read back (from the database), checked: the picture, its size, three anchors, and good pins. */
export function cleanVenueMap(festivalId: string, raw: unknown): VenueMap | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.image !== 'string' || !/^https:\/\//.test(o.image) || !num(o.width, 1, 20000) || !num(o.height, 1, 20000)) return undefined;
  const w = o.width;
  const h = o.height;
  const anchors = (Array.isArray(o.anchors) ? o.anchors : []).flatMap((a): Anchor[] => {
    const x = a as Record<string, unknown>;
    return num(x.x, 0, w) && num(x.y, 0, h) && num(x.lat, -90, 90) && num(x.lon, -180, 180) ? [{ x: x.x, y: x.y, lat: x.lat, lon: x.lon }] : [];
  });
  const pins = (Array.isArray(o.pins) ? o.pins : []).flatMap((p): Pin[] => {
    const x = p as Record<string, unknown>;
    if (typeof x.id !== 'string' || !(PIN_KINDS as readonly string[]).includes(x.kind as string) || !num(x.x, 0, w) || !num(x.y, 0, h)) return [];
    const label = typeof x.label === 'string' ? x.label.trim().slice(0, LABEL_MAX) : '';
    return [{ id: x.id, kind: x.kind as PinKind, label, x: x.x, y: x.y, ...(typeof x.stageId === 'string' && x.stageId ? { stageId: x.stageId } : {}) }];
  });
  return { festivalId, image: o.image, width: w, height: h, anchors: anchors.slice(0, 3), pins: pins.slice(0, PINS_MAX), ...(typeof o.updatedAt === 'string' ? { updatedAt: o.updatedAt } : {}) };
}

/** x = a·lon + b·lat + c, y = d·lon + e·lat + f, from the three anchors. Undefined when they're in a line. */
type Fit = { a: number; b: number; c: number; d: number; e: number; f: number };

function solve3(m: number[][], v: number[]): number[] | undefined {
  const det = (q: number[][]) => q[0][0] * (q[1][1] * q[2][2] - q[1][2] * q[2][1]) - q[0][1] * (q[1][0] * q[2][2] - q[1][2] * q[2][0]) + q[0][2] * (q[1][0] * q[2][1] - q[1][1] * q[2][0]);
  const d = det(m);
  if (Math.abs(d) < 1e-12) return undefined;
  return [0, 1, 2].map((col) => det(m.map((row, i) => row.map((x, j) => (j === col ? v[i] : x)))) / d);
}

export function fitOf(anchors: readonly Anchor[]): Fit | undefined {
  if (anchors.length < 3) return undefined;
  const [p, q, r] = anchors;
  const m = [p, q, r].map((a) => [a.lon, a.lat, 1]);
  const xs = solve3(m, [p.x, q.x, r.x]);
  const ys = solve3(m, [p.y, q.y, r.y]);
  if (!xs || !ys) return undefined;
  return { a: xs[0], b: xs[1], c: xs[2], d: ys[0], e: ys[1], f: ys[2] };
}

/** Where a GPS position falls on the picture. */
export function toPixel(fit: Fit, lat: number, lon: number): { x: number; y: number } {
  return { x: fit.a * lon + fit.b * lat + fit.c, y: fit.d * lon + fit.e * lat + fit.f };
}

/** Where a spot on the picture really is. */
export function toGeo(fit: Fit, x: number, y: number): { lat: number; lon: number } {
  const det = fit.a * fit.e - fit.b * fit.d;
  const dx = x - fit.c;
  const dy = y - fit.f;
  return { lon: (fit.e * dx - fit.b * dy) / det, lat: (fit.a * dy - fit.d * dx) / det };
}

/** On the picture (with a little margin): only then is your dot shown. */
export function onMap(map: VenueMap, p: { x: number; y: number }, margin = 0.05) {
  return p.x >= -map.width * margin && p.x <= map.width * (1 + margin) && p.y >= -map.height * margin && p.y <= map.height * (1 + margin);
}

/** How far apart two spots on the map are, in meters. */
export function metersOnMap(fit: Fit, a: { x: number; y: number }, b: { x: number; y: number }): number {
  return metersBetween(toGeo(fit, a.x, a.y), toGeo(fit, b.x, b.y));
}

export const walkMinutes = (meters: number) => Math.max(1, Math.round(meters / WALK_M_PER_MIN));

/** The nearest pin of a kind to a spot (for "nearest water"). */
export function nearestPin(map: VenueMap, fit: Fit, from: { x: number; y: number }, kind: PinKind): { pin: Pin; meters: number } | undefined {
  let best: { pin: Pin; meters: number } | undefined;
  for (const pin of map.pins) {
    if (pin.kind !== kind) continue;
    const meters = metersOnMap(fit, from, pin);
    if (!best || meters < best.meters) best = { pin, meters };
  }
  return best;
}

/** Walking time between two stages, when both are pinned. */
export function stageWalk(map: VenueMap, fit: Fit, fromStage: string, toStage: string): number | undefined {
  const a = map.pins.find((p) => p.kind === 'stage' && p.stageId === fromStage);
  const b = map.pins.find((p) => p.kind === 'stage' && p.stageId === toStage);
  return a && b ? walkMinutes(metersOnMap(fit, a, b)) : undefined;
}

// ---------------------------------------------------------------------------
// Sets your trail says you stood at

/** Near a stage means within this many meters of its pin. */
export const NEAR_STAGE_M = 80;
/** And for at least this long during the set. */
export const AT_SET_MIN = 15;

export type TrailSet = { artistId: string; day: string; minutes: number; endsAt: number };

/**
 * Each set where your festival trail stayed near its stage for a good while
 * during it: a suggestion for Sets you've seen ("Were you at…?"), never added
 * by itself.
 */
export function setsFromTrail(map: VenueMap, festival: Festival, trail: readonly TrailPoint[]): TrailSet[] {
  const fit = fitOf(map.anchors);
  const starts = dayStarts(festival);
  if (!fit || !starts || trail.length < 2) return [];
  const stagePins = new Map(map.pins.filter((p) => p.kind === 'stage' && p.stageId).map((p) => [p.stageId!, toGeo(fit, p.x, p.y)]));
  const out: TrailSet[] = [];
  for (const set of festival.sets ?? []) {
    const where = stagePins.get(set.stageId);
    const midnight = starts.get(set.day);
    if (!where || !midnight) continue;
    const from = toMinutes(set.start);
    let to = toMinutes(set.end);
    if (to <= from) to += 24 * 60;
    const at = (m: number) => new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate(), 0, m).getTime();
    const s = at(from);
    const e = at(to);
    let ms = 0;
    for (let i = 1; i < trail.length; i++) {
      const [t0, lat0, lon0] = trail[i - 1];
      const [t1] = trail[i];
      if (t1 <= s || t0 >= e) continue;
      if (metersBetween({ lat: lat0, lon: lon0 }, where) > NEAR_STAGE_M) continue;
      ms += Math.min(t1, e) - Math.max(t0, s);
    }
    const minutes = Math.round(ms / 60_000);
    if (minutes >= AT_SET_MIN) out.push({ artistId: set.artistId, day: set.day, minutes, endsAt: e });
  }
  return out.sort((a, b) => a.endsAt - b.endsAt);
}

export type StageNow = { now?: { artistId: string; end: string }; next?: { artistId: string; start: string } };

/** What's on at a stage at this minute of a festival night, and what's next. */
export function stageNow(festival: Festival, stageId: string, night: { day: string; minute: number } | undefined): StageNow {
  if (!night) return {};
  const sets = (festival.sets ?? [])
    .filter((s) => s.day === night.day && s.stageId === stageId)
    .map((s) => {
      const from = toMinutes(s.start);
      let to = toMinutes(s.end);
      if (to <= from) to += 24 * 60;
      return { s, from, to };
    })
    .sort((a, b) => a.from - b.from);
  const on = sets.find((x) => x.from <= night.minute && night.minute < x.to);
  const next = sets.find((x) => x.from > night.minute);
  return { ...(on ? { now: { artistId: on.s.artistId, end: on.s.end } } : {}), ...(next ? { next: { artistId: next.s.artistId, start: next.s.start } } : {}) };
}
