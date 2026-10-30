import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/types';
import { parseLatLon } from '../../admin/AdminMaps';
import { cleanVenueMap, fitOf, metersOnMap, nearestPin, onMap, setsFromTrail, stageNow, stageWalk, toGeo, toPixel, type VenueMap } from '../venueMap';

// A 1000 × 800 picture of about 0.01° × 0.008°, north up: 1 px ≈ 1.1 m across, 1.1 m down.
const map: VenueMap = {
  festivalId: 'f',
  image: 'https://firebasestorage.googleapis.com/v0/b/x/o/venueMaps%2Ff%2Fmap-1.jpg?alt=media',
  width: 1000,
  height: 800,
  anchors: [
    { x: 0, y: 0, lat: 28.54, lon: -81.41 },
    { x: 1000, y: 0, lat: 28.54, lon: -81.4 },
    { x: 0, y: 800, lat: 28.532, lon: -81.41 },
  ],
  pins: [
    { id: 'main', kind: 'stage', label: 'Main', x: 100, y: 100, stageId: 'main' },
    { id: 'tent', kind: 'stage', label: 'Tent', x: 900, y: 100, stageId: 'tent' },
    { id: 'w1', kind: 'water', label: '', x: 500, y: 700 },
    { id: 'w2', kind: 'water', label: '', x: 150, y: 150 },
  ],
};

describe('festival maps', () => {
  it('turns a GPS position into a spot on the picture and back', () => {
    const fit = fitOf(map.anchors)!;
    const p = toPixel(fit, 28.536, -81.405);
    expect(Math.round(p.x)).toBe(500);
    expect(Math.round(p.y)).toBe(400);
    const g = toGeo(fit, 500, 400);
    expect(g.lat).toBeCloseTo(28.536, 6);
    expect(g.lon).toBeCloseTo(-81.405, 6);
    expect(onMap(map, p)).toBe(true);
    expect(onMap(map, toPixel(fit, 28.6, -81.405))).toBe(false);
    // In a line: no fit.
    expect(fitOf([map.anchors[0], map.anchors[1], { x: 500, y: 0, lat: 28.54, lon: -81.405 }])).toBeUndefined();
  });

  it('measures walks between stages and finds the nearest water', () => {
    const fit = fitOf(map.anchors)!;
    expect(Math.round(metersOnMap(fit, map.pins[0], map.pins[1]))).toBe(781);
    expect(stageWalk(map, fit, 'main', 'tent')).toBe(11);
    expect(stageWalk(map, fit, 'main', 'nowhere')).toBeUndefined();
    expect(nearestPin(map, fit, { x: 120, y: 120 }, 'water')?.pin.id).toBe('w2');
  });

  it('reads a stored map safely', () => {
    expect(cleanVenueMap('f', { ...map, image: 'http://x' })).toBeUndefined();
    const m = cleanVenueMap('f', { ...map, pins: [...map.pins, { id: 'x', kind: 'rave', x: 1, y: 1 }, { id: 'y', kind: 'water', x: 5000, y: 1 }] })!;
    expect(m.pins).toHaveLength(4);
  });

  it('says what’s on at a stage now, and finds the sets your trail stood at', () => {
    const festival = {
      id: 'f', name: 'F', dates: '', location: '', lineup: ['a', 'b'], days: ['Friday'], stages: [{ id: 'main', name: 'Main' }, { id: 'tent', name: 'Tent' }],
      startDate: '2026-11-06', endDate: '2026-11-06',
      sets: [
        { artistId: 'a', day: 'Friday', stageId: 'main', start: '22:00', end: '23:00' },
        { artistId: 'b', day: 'Friday', stageId: 'tent', start: '22:00', end: '23:00' },
      ],
    } as Festival;
    expect(stageNow(festival, 'main', { day: 'Friday', minute: 22 * 60 + 30 })).toEqual({ now: { artistId: 'a', end: '23:00' } });
    expect(stageNow(festival, 'main', { day: 'Friday', minute: 21 * 60 })).toEqual({ next: { artistId: 'a', start: '22:00' } });
    const fit = fitOf(map.anchors)!;
    const main = toGeo(fit, 100, 100);
    const at = (h: number, m: number) => new Date(2026, 10, 6, h, m).getTime();
    // At the main stage from 22:05 to 22:40 (a point every 5 minutes).
    const trail = Array.from({ length: 8 }, (_, i) => [at(22, 5 + i * 5), main.lat, main.lon] as const);
    expect(setsFromTrail(map, festival, trail)).toEqual([{ artistId: 'a', day: 'Friday', minutes: 35, endsAt: at(23, 0) }]);
  });

  it('reads coordinates pasted from Google Maps', () => {
    expect(parseLatLon('28.53831, -81.40395')).toEqual({ lat: 28.53831, lon: -81.40395 });
    expect(parseLatLon('nope')).toBeUndefined();
  });
});
