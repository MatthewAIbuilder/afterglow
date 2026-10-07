import { describe, expect, it } from '@jest/globals';
import { SPECTRUM } from '../../../theme/palettes';
import { festivalLight, festivalLights, lightIndex, monthLight } from '../light';

describe('festival lights', () => {
  it('gives every id one of the six lights, the same every time', () => {
    for (const id of ['edc-orlando-26', 'acl-26', 'cyclops-cove-4', '', 'ü']) {
      expect(SPECTRUM).toContain(festivalLight(id));
      expect(festivalLight(id)).toBe(festivalLight(id));
      expect(lightIndex(id)).toBeGreaterThanOrEqual(0);
      expect(lightIndex(id)).toBeLessThan(SPECTRUM.length);
    }
  });

  it('spreads similar ids across the lights', () => {
    const ids = Array.from({ length: 600 }, (_, i) => `festival-${i}-26`);
    const counts = SPECTRUM.map((_, k) => ids.filter((id) => lightIndex(id) === k).length);
    for (const n of counts) expect(n).toBeGreaterThan(60);
    expect(new Set(['edc-orlando-26', 'edc-colombia-26', 'acl-26', 'eternal-nye-26'].map(lightIndex)).size).toBeGreaterThan(2);
  });

  it('pairs a light with the one before it for two-tone washes', () => {
    for (const id of ['edc-orlando-26', 'acl-26', 'cyclops-cove-4']) {
      const [light, dusk] = festivalLights(id);
      expect(light).toBe(festivalLight(id));
      expect(dusk).toBe(SPECTRUM[(lightIndex(id) + SPECTRUM.length - 1) % SPECTRUM.length]);
    }
  });

  it('walks the months through the lights and round again', () => {
    expect(monthLight('2026-01-10')).toBe(SPECTRUM[0]);
    expect(monthLight('2026-06-01')).toBe(SPECTRUM[5]);
    expect(monthLight('2026-07-04')).toBe(SPECTRUM[0]);
    expect(monthLight('2026-12-31')).toBe(SPECTRUM[5]);
    expect(monthLight(undefined)).toBeUndefined();
    expect(monthLight('soon')).toBeUndefined();
  });
});
