import { describe, expect, it } from '@jest/globals';
import { trailCheckins } from '../careReminders';

describe('check-ins on a festival day', () => {
  const morning = new Date(2026, 10, 7, 10, 0);
  it('a few through the day, only with the trail on, each opening the trail', () => {
    const r = trailCheckins('edc-orlando-26', true, morning);
    expect(r.map((x) => x.at.getHours())).toEqual([15, 18, 21]);
    expect(r.every((x) => x.href === '/trail')).toBe(true);
    expect(new Set(r.map((x) => x.id)).size).toBe(3);
    expect(trailCheckins('edc-orlando-26', false, morning)).toEqual([]);
    expect(trailCheckins(undefined, true, morning)).toEqual([]);
  });

  it('the ones already past are left out', () => {
    expect(trailCheckins('edc-orlando-26', true, new Date(2026, 10, 7, 19, 0)).map((x) => x.at.getHours())).toEqual([21]);
    expect(trailCheckins('edc-orlando-26', true, new Date(2026, 10, 7, 22, 0))).toEqual([]);
  });
});
