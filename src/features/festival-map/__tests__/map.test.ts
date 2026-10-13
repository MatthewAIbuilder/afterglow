import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import {
  DEFAULT_BOX,
  DOTS_MAX,
  boxAround,
  clusterMarkers,
  dotsPath,
  filterMarkers,
  fitView,
  isLand,
  landDots,
  mapMarkers,
  project,
  regionOf,
  safeRegion,
  unplacedLine,
  unproject,
  arcPath,
  journeyOf,
  reachEllipse,
} from '../map';

const fest = (id: string, extra: Partial<Festival> = {}): Festival =>
  ({ id, name: id, dates: '', location: '', lineup: [], days: [], stages: [], ...extra }) as unknown as Festival;

describe('land', () => {
  it('knows land from sea', () => {
    expect(isLand(28.54, -81.38)).toBe(true); // Orlando
    expect(isLand(30.27, -97.77)).toBe(true); // Austin
    expect(isLand(51.5, -0.12)).toBe(true); // London
    expect(isLand(-33.87, 151.2)).toBe(true); // Sydney
    expect(isLand(35, -40)).toBe(false); // the middle of the Atlantic
    expect(isLand(0, -150)).toBe(false); // the Pacific
    expect(isLand(-80, 0)).toBe(false); // off the grid: sea
  });

  it('projects and back', () => {
    const p = { lat: 30.27, lon: -97.77 };
    const back = unproject(project(p));
    expect(back.lat).toBeCloseTo(p.lat);
    expect(back.lon).toBeCloseTo(p.lon);
    // North is up.
    expect(project({ lat: 40, lon: 0 }).y).toBeLessThan(project({ lat: 30, lon: 0 }).y);
  });

  it('draws dots only on land, on a stable grid, never too many', () => {
    const box = boxAround([project({ lat: 28.5, lon: -81.4 }), project({ lat: 34.1, lon: -117.3 })]);
    const dots = landDots(box, 1);
    expect(dots.length).toBeGreaterThan(100);
    expect(dots.every((d) => isLand(-d.y, d.x / Math.cos((38 * Math.PI) / 180)))).toBe(true);
    // The same place gets the same dot when the box moves.
    const shifted = landDots({ ...box, x0: box.x0 + 0.37, x1: box.x1 + 0.37 }, 1);
    const key = (d: { x: number; y: number }) => `${d.x.toFixed(4)},${d.y.toFixed(4)}`;
    const a = new Set(dots.map(key));
    expect(shifted.filter((d) => a.has(key(d))).length).toBeGreaterThan(dots.length * 0.8);
    expect(landDots({ x0: -150, y0: -80, x1: 150, y1: 60 }, 0.01).length).toBeLessThanOrEqual(DOTS_MAX);
    expect(dotsPath(dots.slice(0, 2), box, 10, 1)).toMatch(/^M[-\d.]+ [-\d.]+a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M/);
  });
});

describe('framing', () => {
  it('fits the festivals with room around them, and never too close', () => {
    const one = boxAround([{ x: 0, y: 0 }]);
    expect(one.x1 - one.x0).toBeGreaterThanOrEqual(12);
    expect(boxAround([])).toBe(DEFAULT_BOX);
    const v = fitView({ x0: 0, y0: 0, x1: 100, y1: 50 }, 400, 400);
    expect(v.scale).toBe(4);
    expect(v.cx).toBe(50);
    expect(v.cy).toBe(25);
  });
});

describe('markers', () => {
  const today = new Date(2026, 9, 3);
  const places: Record<string, { lat: number; lon: number }> = {
    a: { lat: 28.5, lon: -81.4 },
    b: { lat: 28.6, lon: -81.3 },
    c: { lat: 34.1, lon: -117.3 },
    d: { lat: 40, lon: -74 },
  };
  const festivals = [
    fest('a', { startDate: '2026-12-01', endDate: '2026-12-02' }),
    fest('b', { startDate: '2026-11-01', endDate: '2026-11-02' }),
    fest('c', { startDate: '2026-11-10', endDate: '2026-11-12' }),
    fest('d', { startDate: '2026-01-01', endDate: '2026-01-02' }),
    fest('nowhere', { startDate: '2026-11-10' }),
  ];
  const markers = mapMarkers(festivals, {
    placeOf: (f) => places[f.id],
    going: ['a', 'd'],
    lovedOn: (f) => (f.id === 'c' ? 3 : 0),
    today,
  });

  it('places festivals with a place, the ones that matter most first', () => {
    expect(markers.map((m) => m.festival.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(markers.map((m) => m.tone)).toEqual(['going', 'love', 'more', 'over']);
    expect(markers.find((m) => m.festival.id === 'd')?.going).toBe(true);
    expect(unplacedLine(festivals.length - markers.length)).toBe('1 festival has no place yet, so it isn’t on the map.');
    expect(unplacedLine(0)).toBeUndefined();
  });

  it('filters to yours (been there too), for you, or everything still to come', () => {
    expect(filterMarkers(markers, 'going').map((m) => m.festival.id)).toEqual(['a', 'd']);
    expect(filterMarkers(markers, 'love').map((m) => m.festival.id)).toEqual(['a', 'c']);
    expect(filterMarkers(markers, 'all').map((m) => m.festival.id)).toEqual(['a', 'c', 'b']);
  });

  it('shares a light between festivals that would overlap, until you zoom in', () => {
    const far = clusterMarkers(markers, 6, 26);
    const orlando = far.find((c) => c.lead.festival.id === 'a');
    expect(orlando?.members.map((m) => m.festival.id)).toEqual(['a', 'b']);
    const near = clusterMarkers(markers, 400, 26);
    expect(near).toHaveLength(4);
  });
});

describe('your journey', () => {
  it('goes through your festivals in date order, as arcs', () => {
    const m = (id: string, start: string | undefined, going: boolean, x: number) =>
      ({ festival: fest(id, { startDate: start }), going, at: { x, y: 0 }, tone: 'going', loved: 0, point: { lat: 0, lon: 0 } }) as never;
    expect(journeyOf([m('b', '2026-12-01', true, 2), m('a', '2026-11-01', true, 1), m('c', '2026-10-01', false, 3), m('d', undefined, true, 4)]).map((x: { festival: Festival }) => x.festival.id)).toEqual(['a', 'b', 'd']);
    const path = arcPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(path.d).toBe('M0 0Q5 -2.2 10 0Q12.2 5 10 10');
    expect(path.length).toBeGreaterThan(20);
    expect(arcPath([{ x: 1, y: 1 }]).length).toBe(0);
  });
});

describe('near you on the map', () => {
  it('draws your reach a bit wider than tall up north, as the map is', () => {
    const r = reachEllipse({ lat: 38, lon: -90 }, 500);
    expect(r.ry).toBeCloseTo(4.5, 1);
    expect(r.rx).toBeCloseTo(r.ry, 1); // true scale at 38°N
    const north = reachEllipse({ lat: 55, lon: 0 }, 500);
    expect(north.rx).toBeGreaterThan(north.ry);
  });
});

describe('safeRegion: a region Apple’s map always takes', () => {
  it('shrinks a frame wider than the world, or taller than pole to pole', () => {
    const r = safeRegion({ latitude: 10, longitude: -20, latitudeDelta: 240, longitudeDelta: 420 });
    expect(r.longitudeDelta).toBeLessThanOrEqual(350);
    expect(r.latitude + r.latitudeDelta / 2).toBeLessThan(90);
    expect(r.latitude - r.latitudeDelta / 2).toBeGreaterThan(-90);
    expect(r.longitude).toBe(-20);
  });

  it('keeps the centre off the poles, wraps the longitude, and never passes NaN on', () => {
    expect(safeRegion({ latitude: 89, longitude: 190, latitudeDelta: 10, longitudeDelta: 10 })).toMatchObject({ latitude: 85, longitude: -170 });
    const r = safeRegion({ latitude: NaN, longitude: Infinity, latitudeDelta: NaN, longitudeDelta: -5 });
    for (const v of Object.values(r)) expect(Number.isFinite(v)).toBe(true);
    expect(r.longitudeDelta).toBeGreaterThan(0);
  });

  it('leaves an ordinary region alone', () => {
    const ok = { latitude: 28.5, longitude: -81.4, latitudeDelta: 3, longitudeDelta: 3 };
    expect(safeRegion(ok)).toEqual(ok);
  });

  it('frames festivals from California to Australia without breaking the map', () => {
    const r = safeRegion(regionOf(boxAround([project({ lat: 34, lon: -118 }), project({ lat: -33.9, lon: 151.2 }), project({ lat: 51, lon: 4 })])));
    expect(r.longitudeDelta).toBeLessThanOrEqual(350);
    expect(r.latitude + r.latitudeDelta / 2).toBeLessThan(90);
  });
});
