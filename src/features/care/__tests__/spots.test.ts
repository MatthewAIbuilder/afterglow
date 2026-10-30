import { describe, expect, it } from '@jest/globals';
import { arrowAngle, bearing, cleanSpots, compassWord, mapsLink, saveSpot, type Spot, spotName, SPOTS_MAX, wayTo } from '../spots';

const spot = (id: string, kind: Spot['kind'], at: number, lat = 28.5, lon = -81.4): Spot => ({ id, kind, lat, lon, at });

describe('find my way back', () => {
  it('keeps one car and one tent, and any number of spots up to the most', () => {
    let all = saveSpot([], spot('car', 'car', 1));
    all = saveSpot(all, spot('car', 'car', 2, 28.6));
    all = saveSpot(all, spot('tent', 'tent', 3));
    expect(all.map((s) => `${s.kind}@${s.at}`)).toEqual(['tent@3', 'car@2']);
    for (let i = 0; i < 12; i++) all = saveSpot(all, spot(`spot-${i}`, 'spot', 10 + i));
    expect(all).toHaveLength(SPOTS_MAX);
    expect(all[0].id).toBe('spot-11');
  });

  it('reads back stored spots whatever their shape, newest first', () => {
    expect(cleanSpots('x')).toEqual([]);
    expect(cleanSpots([{ id: 'car', kind: 'car', lat: 91, lon: 0, at: 1 }, { id: 'a', kind: 'spot', label: '  Gate C ', lat: 1, lon: 2, at: 5 }, { id: 'b', kind: 'boat', lat: 1, lon: 2, at: 6 }])).toEqual([
      { id: 'a', kind: 'spot', label: 'Gate C', lat: 1, lon: 2, at: 5 },
    ]);
  });

  it('says how far, which way and how long a walk', () => {
    const car = spot('car', 'car', 1, 28.5009, -81.4);
    const way = wayTo({ lat: 28.5, lon: -81.4 }, car);
    expect(Math.round(way.meters)).toBe(100);
    expect(way.minutes).toBe(1);
    expect(Math.round(way.bearing)).toBe(0);
    expect(compassWord(bearing({ lat: 0, lon: 0 }, { lat: 1, lon: 1 }))).toBe('north-east');
    // Facing east, a spot due north is a quarter turn to the left.
    expect(arrowAngle(0, 90)).toBe(270);
    expect(wayTo({ lat: 28.50005, lon: -81.4 }, car).here).toBe(false);
    expect(wayTo({ lat: 28.50089, lon: -81.4 }, car).here).toBe(true);
    expect(spotName(car)).toBe('My car');
    expect(spotName({ kind: 'spot', label: 'Our flag' })).toBe('Our flag');
    expect(mapsLink(car, true)).toBe('https://maps.apple.com/?daddr=28.500900,-81.400000&dirflg=w');
  });
});
