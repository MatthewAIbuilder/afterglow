import type { Festival } from '../../data/models';
import type { Point } from '../festivals/near';
import { isOver } from '../festivals/shelves';
import { LAND, LAND_COLS, LAND_NORTH, LAND_ROWS, LAND_STEP } from './land';
import { t, tn } from '../../i18n';

/**
 * The festival map, pure. The world is drawn as dots of light on a night sky
 * (a dot wherever there's land), festivals glow where they happen. Positions
 * use an equidistant cylindrical projection with its true scale at 38°N, so
 * North America and Europe keep a natural shape: x = longitude × cos 38°,
 * y = −latitude, both in "map units" (degrees), turned into pixels by a scale.
 */

/** cos 38°: how much narrower a degree of longitude is than a degree of latitude around the US. */
export const LON_SCALE = Math.cos((38 * Math.PI) / 180);

export type MapPoint = { x: number; y: number };
export type Box = { x0: number; y0: number; x1: number; y1: number };

export const project = (p: Point): MapPoint => ({ x: p.lon * LON_SCALE, y: -p.lat });
export const unproject = (m: MapPoint): Point => ({ lat: -m.y, lon: m.x / LON_SCALE });

let grid: Uint8Array | undefined;
/** The land grid, decoded once. */
function landGrid(): Uint8Array {
  if (grid) return grid;
  const g = new Uint8Array(LAND_ROWS * LAND_COLS);
  LAND.split('|').forEach((row, r) => {
    let c = 0;
    let on = false;
    for (const run of row.split('.')) {
      const n = parseInt(run, 36);
      if (on) g.fill(1, r * LAND_COLS + c, r * LAND_COLS + Math.min(LAND_COLS, c + n));
      c += n;
      on = !on;
    }
  });
  grid = g;
  return g;
}

/** Is there land here? (The far north and Antarctica are left as sea.) */
export function isLand(lat: number, lon: number): boolean {
  const r = Math.floor((LAND_NORTH - lat) / LAND_STEP);
  let c = Math.floor((((lon + 180) % 360) + 360) % 360 / LAND_STEP);
  if (c >= LAND_COLS) c = LAND_COLS - 1;
  if (r < 0 || r >= LAND_ROWS) return false;
  return landGrid()[r * LAND_COLS + c] === 1;
}

/** The continental US: where the map looks when no festival has a place. */
export const DEFAULT_BOX: Box = { x0: -125 * LON_SCALE, y0: -50, x1: -66 * LON_SCALE, y1: -24 };

/** A box around these points, padded, never smaller than `minSpan` map units across. */
export function boxAround(points: readonly MapPoint[], opts: { pad?: number; minSpan?: number } = {}): Box {
  if (!points.length) return DEFAULT_BOX;
  const pad = opts.pad ?? 0.2;
  const minSpan = opts.minSpan ?? 12;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  const w = Math.max(minSpan, (x1 - x0) * (1 + pad * 2));
  const h = Math.max(minSpan * 0.6, (y1 - y0) * (1 + pad * 2));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
}

export type View = {
  /** Pixels per map unit. */
  scale: number;
  /** The map unit at the middle of the area. */
  cx: number;
  cy: number;
};

/** Fits a box into an area of this many pixels. */
export function fitView(box: Box, width: number, height: number): View {
  const w = Math.max(1e-6, box.x1 - box.x0);
  const h = Math.max(1e-6, box.y1 - box.y0);
  return { scale: Math.min(width / w, height / h), cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2 };
}

/** Grows a box by `by` of its size on every side. */
export const grow = (b: Box, by: number): Box => {
  const dx = (b.x1 - b.x0) * by;
  const dy = (b.y1 - b.y0) * by;
  return { x0: b.x0 - dx, y0: b.y0 - dy, x1: b.x1 + dx, y1: b.y1 + dy };
};

/** Never finer than the land grid, so dots stay meaningful. */
export const MIN_SPACING = LAND_STEP;
/** At most this many dots in one drawing, however big the area. */
export const DOTS_MAX = 14000;

/**
 * The land dots inside a box, on a grid `spacing` map units apart (aligned to
 * multiples of it, so the same place always has the same dot). Gets coarser
 * by itself rather than draw more than `DOTS_MAX`.
 */
export function landDots(box: Box, spacing: number): MapPoint[] {
  let s = Math.max(MIN_SPACING, spacing);
  while (((box.x1 - box.x0) / s) * ((box.y1 - box.y0) / s) > DOTS_MAX * 3.5) s *= 1.25;
  const dots: MapPoint[] = [];
  const ix0 = Math.ceil(box.x0 / s);
  const ix1 = Math.floor(box.x1 / s);
  const iy0 = Math.ceil(box.y0 / s);
  const iy1 = Math.floor(box.y1 / s);
  for (let iy = iy0; iy <= iy1; iy++) {
    const y = iy * s;
    for (let ix = ix0; ix <= ix1; ix++) {
      const x = ix * s;
      if (isLand(-y, x / LON_SCALE)) dots.push({ x, y });
    }
  }
  return dots.length > DOTS_MAX ? dots.filter((_, i) => i % Math.ceil(dots.length / DOTS_MAX) === 0) : dots;
}

/**
 * One SVG path drawing every dot as a small circle, in pixels relative to the
 * box's top-left corner at this scale. One path keeps it to one drawing on the phone.
 */
export function dotsPath(dots: readonly MapPoint[], box: Box, scale: number, r: number): string {
  const d = (n: number) => Math.round(n * 10) / 10;
  const rr = d(r);
  const parts: string[] = [];
  for (const p of dots) {
    const x = d((p.x - box.x0) * scale - r);
    const y = d((p.y - box.y0) * scale);
    parts.push(`M${x} ${y}a${rr} ${rr} 0 1 0 ${d(r * 2)} 0a${rr} ${rr} 0 1 0 ${-d(r * 2)} 0`);
  }
  return parts.join('');
}

export type MarkerTone = 'going' | 'love' | 'more' | 'over';

export type Marker = {
  festival: Festival;
  point: Point;
  at: MapPoint;
  tone: MarkerTone;
  /** Acts on the lineup you'd love. */
  loved: number;
  /** You're going (or went, once it's over). */
  going: boolean;
};

/** Going first, then most you'd love, then soonest. Over last. */
const toneRank: Record<MarkerTone, number> = { going: 0, love: 1, more: 2, over: 3 };

/** Every festival with a place, as a light on the map, the ones that matter most first. */
export function mapMarkers(
  festivals: readonly Festival[],
  ctx: {
    placeOf: (f: Festival) => Point | undefined;
    going: readonly string[];
    lovedOn: (f: Festival) => number;
    today: Date;
  },
): Marker[] {
  const markers: Marker[] = [];
  for (const f of festivals) {
    const point = ctx.placeOf(f);
    if (!point) continue;
    const loved = ctx.lovedOn(f);
    const over = isOver(f, ctx.today);
    const tone: MarkerTone = over ? 'over' : ctx.going.includes(f.id) ? 'going' : loved > 0 ? 'love' : 'more';
    markers.push({ festival: f, point, at: project(point), tone, loved, going: ctx.going.includes(f.id) });
  }
  const start = (f: Festival) => f.startDate ?? '9999';
  return markers.sort(
    (a, b) => toneRank[a.tone] - toneRank[b.tone] || b.loved - a.loved || start(a.festival).localeCompare(start(b.festival)),
  );
}

export type MapFilter = 'all' | 'going' | 'love';

/** What each filter keeps: yours (going, and been there), ones with acts you'd love, or every festival that isn't over. */
export function filterMarkers(markers: readonly Marker[], filter: MapFilter): Marker[] {
  if (filter === 'going') return markers.filter((m) => m.going);
  if (filter === 'love') return markers.filter((m) => m.tone !== 'over' && (m.loved > 0 || m.tone === 'going'));
  return markers.filter((m) => m.tone !== 'over');
}

export type Cluster = { lead: Marker; members: Marker[]; at: MapPoint };

/**
 * Festivals closer than `px` pixels at this scale share one light (the most
 * important one leads; the card lists the rest). Greedy, in marker order.
 */
export function clusterMarkers(markers: readonly Marker[], scale: number, px: number): Cluster[] {
  const clusters: Cluster[] = [];
  const reach = px / Math.max(1e-6, scale);
  for (const m of markers) {
    const near = clusters.find((c) => Math.hypot(c.at.x - m.at.x, c.at.y - m.at.y) < reach);
    if (near) near.members.push(m);
    else clusters.push({ lead: m, members: [m], at: m.at });
  }
  return clusters;
}

/** "3 festivals here" for a cluster; the festival's own name for one. */
export const clusterLabel = (c: Cluster) => (c.members.length > 1 ? t('{festival} and {n} more', { festival: c.lead.festival.name, n: c.members.length - 1 }) : c.lead.festival.name);

/** "4 festivals aren't on the map yet: they have no place." */
export function unplacedLine(n: number): string | undefined {
  if (n <= 0) return undefined;
  return tn(n, '{n} festival has no place yet, so it isn’t on the map.', '{n} festivals have no place yet, so they aren’t on the map.');
}

/** Festivals in date order (undated last). */
export const inDateOrder = (markers: readonly Marker[]): Marker[] =>
  [...markers].sort((a, b) => (a.festival.startDate ?? '9999').localeCompare(b.festival.startDate ?? '9999'));

/** Your festivals in date order (undated last), for the journey line. */
export const journeyOf = (markers: readonly Marker[]): Marker[] => inDateOrder(markers.filter((m) => m.going));

/**
 * A path through points as gentle arcs (each leg bowing to its left by
 * `bend` of its length, like a flight path), with its total length (roughly)
 * for drawing it in. Legs between the same place are skipped.
 */
export function arcPath(points: readonly MapPoint[], bend = 0.22): { d: string; length: number } {
  const r = (n: number) => Math.round(n * 10) / 10;
  let d = '';
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0) {
      d += `M${r(p.x)} ${r(p.y)}`;
      continue;
    }
    const a = points[i - 1];
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    const leg = Math.hypot(dx, dy);
    if (leg < 0.5) continue;
    const cx = (a.x + p.x) / 2 + dy * bend;
    const cy = (a.y + p.y) / 2 - dx * bend;
    d += `Q${r(cx)} ${r(cy)} ${r(p.x)} ${r(p.y)}`;
    // A quadratic arc is a little longer than its chord.
    length += leg * (1 + (8 / 3) * bend * bend);
  }
  return { d, length };
}

/** How far `km` reaches around a point, in map units across (rx) and up (ry): the Near you circle. */
export function reachEllipse(at: Point, km: number): { rx: number; ry: number } {
  const ry = km / 111.2;
  const rx = (km / (111.2 * Math.max(0.05, Math.cos((at.lat * Math.PI) / 180)))) * LON_SCALE;
  return { rx, ry };
}

/** A region of the world as native maps take it: a centre and how many degrees it spans. */
export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

/** Apple's map keeps a region's centre this far from the poles. */
const POLE_MARGIN = 5;
/** The widest region Apple's map takes, in degrees across (it allows 360; a little less leaves room for rounding). */
const MAX_LON_DELTA = 350;
/** The smallest span, in degrees (deeper than street level). */
const MIN_DELTA = 0.0005;

/**
 * A region Apple's map always accepts. MapKit stops the whole app ("Invalid
 * Region") for a region more than 180° tall or 360° wide, one reaching past a
 * pole, or one with a centre that isn't a number, and festivals spread across
 * the world (with the frame's padding) can ask for exactly that. The centre
 * stays put where it can; the span shrinks to fit.
 */
export function safeRegion(r: Region): Region {
  const finite = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
  const latitude = Math.max(-(90 - POLE_MARGIN), Math.min(90 - POLE_MARGIN, finite(r.latitude, 0)));
  const lon = finite(r.longitude, 0);
  const longitude = lon >= -180 && lon <= 180 ? lon : ((((lon + 180) % 360) + 360) % 360) - 180;
  const maxLat = 2 * (90 - Math.abs(latitude)) - 1;
  const latitudeDelta = Math.max(MIN_DELTA, Math.min(maxLat, finite(r.latitudeDelta, 1)));
  const longitudeDelta = Math.max(MIN_DELTA, Math.min(MAX_LON_DELTA, finite(r.longitudeDelta, 1)));
  return { latitude, longitude, latitudeDelta, longitudeDelta };
}

/** The region covering a box. */
export function regionOf(box: Box): Region {
  const c = unproject({ x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 });
  return { latitude: c.lat, longitude: c.lon, latitudeDelta: Math.max(0.01, box.y1 - box.y0), longitudeDelta: Math.max(0.01, (box.x1 - box.x0) / LON_SCALE) };
}

/** Pixels per map unit when this region fills `width` pixels across: how festival lights cluster at that zoom. */
export const pxPerUnit = (region: Pick<Region, 'longitudeDelta'>, width: number) => width / (Math.max(1e-6, region.longitudeDelta) * LON_SCALE);

/** Every festival's name shows once the map spans fewer degrees across than this. */
export const NAMES_DELTA = 9;
/** Zoomed in this far (degrees across), you're at street level: the "Edge of the map" secret. */
export const STREET_DELTA = 0.02;
/** How far in a single festival frames: a city and its surroundings. */
export const SINGLE_DELTA = 3;
