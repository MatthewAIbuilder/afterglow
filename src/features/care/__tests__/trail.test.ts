import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import {
  addFixes,
  askKey,
  boxOf,
  cleanPrefs,
  cleanTrails,
  dayOf,
  daysOf,
  distanceText,
  durationText,
  MAX_ACCURACY_M,
  MAX_POINTS,
  metersBetween,
  trailFestival,
  trailPlan,
  trailStats,
  trailUntil,
  type Fix,
  type TrailPoint,
} from '../trail';

const MIN = 60_000;
const T0 = new Date(2026, 10, 6, 15, 0).getTime();
// About 111 metres per 0.001 degrees of latitude.
const fix = (i: number, over: Partial<Fix> = {}): Fix => ({ at: T0 + i * MIN, lat: 28.6 + i * 0.001, lon: -81.2, accuracy: 10, ...over });

const festival = { id: 'edc-orlando-26', name: 'EDC Orlando', startDate: '2026-11-06', endDate: '2026-11-08', lineup: [], days: ['Friday', 'Saturday', 'Sunday'] } as unknown as Festival;

describe('what the phone reports becomes the trail', () => {
  it('keeps real steps in order and leaves out the rest', () => {
    const t = addFixes([], [fix(2), fix(0), fix(1)]);
    expect(t.map((p) => p[0])).toEqual([T0, T0 + MIN, T0 + 2 * MIN]);
    // Rounded to a metre or so.
    expect(t[0][1]).toBe(28.6);
  });

  it('ignores positions that are vague, standing still, a jump or out of order', () => {
    const base = addFixes([], [fix(0)]);
    expect(addFixes(base, [fix(1, { accuracy: MAX_ACCURACY_M + 1 })])).toHaveLength(1);
    expect(addFixes(base, [fix(1, { lat: base[0][1] + 0.00002 })])).toHaveLength(1);
    // Two kilometres in a minute is a jump, not a walk.
    expect(addFixes(base, [{ at: T0 + MIN, lat: base[0][1] + 0.02, lon: base[0][2], accuracy: 5 }])).toHaveLength(1);
    expect(addFixes(base, [{ at: T0 - MIN, lat: 28.7, lon: -81.2, accuracy: 5 }])).toHaveLength(1);
    expect(addFixes(base, [{ at: Number.NaN, lat: 1, lon: 1 }, { at: T0 + MIN, lat: 99, lon: 1 }])).toHaveLength(1);
  });

  it('a very long day is thinned, never beyond the cap', () => {
    const many: Fix[] = Array.from({ length: MAX_POINTS + 50 }, (_, i) => ({ at: T0 + i * 40_000, lat: 28.6 + (i % 2 ? 0.0004 : 0) + i * 0.00002, lon: -81.2 + (i % 2 ? 0.0004 : 0), accuracy: 5 }));
    const t = addFixes([], many);
    expect(t.length).toBeLessThanOrEqual(MAX_POINTS);
    expect(t.length).toBeGreaterThan(MAX_POINTS / 2 - 100);
  });

  it('saved trails read back clean', () => {
    expect(cleanTrails({ a: [[3, 1, 1], [1, 1, 1], ['x', 1, 1], [2, 1]], b: 'nope', '': [[1, 1, 1]] })).toEqual({ a: [[1, 1, 1], [3, 1, 1]] });
    expect(cleanTrails(null)).toEqual({});
  });
});

describe('the numbers', () => {
  it('distance, days and time out', () => {
    expect(Math.round(metersBetween({ lat: 28.6, lon: -81.2 }, { lat: 28.601, lon: -81.2 }))).toBe(111);
    const pts = addFixes([], [0, 1, 2, 3].map((i) => fix(i)));
    const s = trailStats(pts);
    expect(Math.round(s.meters)).toBe(334);
    expect(s.spanMs).toBe(3 * MIN);
    expect(s.movingMs).toBe(3 * MIN);
    // A long stop isn't moving.
    const stop: TrailPoint[] = [[T0, 28.6, -81.2], [T0 + 60 * MIN, 28.602, -81.2]];
    expect(trailStats(stop).movingMs).toBe(0);
  });

  it('a festival day runs until 7 AM the next morning', () => {
    expect(dayOf(new Date(2026, 10, 7, 2, 0).getTime())).toBe('2026-11-06');
    expect(dayOf(new Date(2026, 10, 7, 9, 0).getTime())).toBe('2026-11-07');
    const days = daysOf([[new Date(2026, 10, 7, 1, 0).getTime(), 1, 1], [new Date(2026, 10, 6, 20, 0).getTime(), 1, 1], [new Date(2026, 10, 7, 14, 0).getTime(), 1, 1]]);
    expect(days.map((d) => d.day)).toEqual(['2026-11-06', '2026-11-07']);
    expect(days[0].points).toHaveLength(2);
  });

  it('reads well in km or miles', () => {
    expect(distanceText(420, false)).toBe('420 m');
    expect(distanceText(5230, false)).toBe('5.2 km');
    expect(distanceText(5230, true)).toBe('3.2 mi');
    expect(distanceText(40, true)).toBe('131 ft');
    expect(durationText(40 * MIN)).toBe('40 min');
    expect(durationText(320 * MIN)).toBe('5 h 20 min');
  });

  it('frames the map around the walk, never tighter than a street or two', () => {
    const b = boxOf([[1, 28.6, -81.2], [2, 28.6004, -81.2004]]);
    expect(b.latitudeDelta).toBeGreaterThanOrEqual(0.0014);
    expect(b.latitude).toBeCloseTo(28.6002, 4);
  });
});

describe('only on a festival day you said yes to', () => {
  const on = new Date(2026, 10, 7, 16, 0);

  it('the festival whose day it is for you', () => {
    expect(trailFestival([festival], ['edc-orlando-26'], on)?.id).toBe('edc-orlando-26');
    expect(trailFestival([festival], [], on)).toBeUndefined();
    expect(trailFestival([festival], ['edc-orlando-26'], new Date(2026, 9, 20, 16, 0))).toBeUndefined();
    expect(trailFestival([festival], ['edc-orlando-26'], new Date(2026, 10, 12, 16, 0))).toBeUndefined();
  });

  it('stops by itself at 7 AM after the last day', () => {
    expect(trailUntil(festival, on)).toBe(new Date(2026, 10, 9, 7, 0).getTime());
    expect(trailUntil(festival, new Date(2026, 10, 9, 3, 0))).toBe(new Date(2026, 10, 9, 7, 0).getTime());
    expect(trailUntil(festival, new Date(2026, 10, 12, 3, 0))).toBeUndefined();
  });

  it('asks once a day, records when you said yes, otherwise does nothing', () => {
    expect(trailPlan(cleanPrefs(undefined), festival, on)).toEqual({ do: 'ask', festival });
    expect(trailPlan({ mode: 'ask', askedFor: askKey(festival.id, on) }, festival, on)).toEqual({ do: 'stop' });
    // The next day it asks again.
    expect(trailPlan({ mode: 'ask', askedFor: askKey(festival.id, on) }, festival, new Date(2026, 10, 8, 16, 0)).do).toBe('ask');
    expect(trailPlan({ mode: 'on' }, festival, on)).toEqual({ do: 'record', festival, until: new Date(2026, 10, 9, 7, 0).getTime() });
    expect(trailPlan({ mode: 'off' }, festival, on)).toEqual({ do: 'stop' });
    // Any other day: stop, whatever you chose.
    expect(trailPlan({ mode: 'on' }, undefined, new Date(2026, 8, 1))).toEqual({ do: 'stop' });
  });
});
