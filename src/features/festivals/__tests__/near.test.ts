import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { distanceKm, distanceLabel, distanceShort, isPoint, lookupText, nearYou, reachLabel, roughly, unitsFor } from '../near';

const ORLANDO = { lat: 28.54, lon: -81.38 };
const TAMPA = { lat: 27.95, lon: -82.46 };
const MIAMI = { lat: 25.76, lon: -80.19 };
const LA = { lat: 34.05, lon: -118.24 };

const fest = (id: string, start: string, place?: { lat: number; lon: number }, location = 'Somewhere'): Festival => ({
  id,
  name: id,
  dates: start,
  location,
  lineup: [],
  days: [],
  stages: [],
  startDate: start,
  endDate: start,
  ...(place ? { place } : {}),
});

describe('festivals near you', () => {
  it('measures straight-line distance', () => {
    expect(distanceKm(ORLANDO, TAMPA)).toBeGreaterThan(110);
    expect(distanceKm(ORLANDO, TAMPA)).toBeLessThan(135);
    expect(distanceKm(ORLANDO, LA)).toBeGreaterThan(3500);
    expect(distanceKm(ORLANDO, ORLANDO)).toBe(0);
  });

  it('keeps only real points, rounded to about a kilometre', () => {
    expect(isPoint({ lat: 0, lon: 0 })).toBe(false);
    expect(isPoint({ lat: 91, lon: 0 })).toBe(false);
    expect(isPoint({ lat: '1', lon: 2 })).toBe(false);
    expect(isPoint(TAMPA)).toBe(true);
    expect(roughly({ lat: 28.53834, lon: -81.37924 })).toEqual({ lat: 28.54, lon: -81.38 });
  });

  it('lists festivals within reach, nearest first, never ones that are over', () => {
    const today = new Date(2026, 9, 1);
    const festivals = [
      fest('miami', '2026-11-01', MIAMI),
      fest('tampa', '2026-12-01', TAMPA),
      fest('la', '2026-11-01', LA),
      fest('over', '2026-09-01', TAMPA),
      fest('nowhere', '2026-11-01'),
      fest('looked-up', '2026-10-20', undefined, 'Orlando, FL'),
    ];
    const placeOf = (f: Festival) => f.place ?? (f.location === 'Orlando, FL' ? ORLANDO : undefined);
    const near = nearYou(festivals, ORLANDO, placeOf, today);
    expect(near.map((n) => n.festival.id)).toEqual(['looked-up', 'tampa', 'miami']);
    expect(nearYou(festivals, ORLANDO, placeOf, today, { max: 1 })).toHaveLength(1);
    // Equally far (to 10 km): the soonest first.
    const twins = [fest('later', '2026-12-01', TAMPA), fest('sooner', '2026-11-01', { lat: 27.96, lon: -82.46 })];
    expect(nearYou(twins, ORLANDO, (f) => f.place, today).map((n) => n.festival.id)).toEqual(['sooner', 'later']);
  });

  it('speaks miles where people drive in miles', () => {
    expect(unitsFor('en-US')).toBe('mi');
    expect(unitsFor('en_GB')).toBe('mi');
    expect(unitsFor('de-DE')).toBe('km');
    expect(unitsFor('en')).toBe('km');
    expect(unitsFor(undefined)).toBe('km');
    expect(distanceLabel(130, 'mi')).toBe('81 mi away');
    expect(distanceLabel(0.5, 'km')).toBe('Under 1 km away');
    expect(distanceShort(2000, 'mi')).toBe('1,240 mi');
    expect(distanceShort(2000, 'km')).toBe('2,000 km');
    expect(reachLabel('mi')).toBe('Within 300 mi');
    expect(reachLabel('km')).toBe('Within 500 km');
  });

  it('looks up a festival by its location text', () => {
    expect(lookupText({ location: '  Sunset Cove Amphitheater,   Boca Raton ' })).toBe('Sunset Cove Amphitheater, Boca Raton');
    expect(lookupText({ location: '' })).toBeUndefined();
  });
});
