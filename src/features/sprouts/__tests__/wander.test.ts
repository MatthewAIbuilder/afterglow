import { describe, expect, it } from '@jest/globals';
import { wander } from '../motion';

describe('sprouts wandering', () => {
  it('stays near its spot, comes back by the end of the loop, and rests between strolls', () => {
    for (const legs of [3, 4, 5])
      for (const phase of [0, 0.37, 0.81]) {
        const start = wander(0, legs, phase);
        const end = wander(0.999999, legs, phase);
        expect(Math.abs(start.x - end.x)).toBeLessThan(0.01);
        expect(Math.abs(start.y - end.y)).toBeLessThan(0.01);
        for (let i = 0; i < 200; i++) {
          const w = wander(i / 200, legs, phase);
          expect(Math.abs(w.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(w.y)).toBeLessThanOrEqual(1);
          expect(w.walking).toBeGreaterThanOrEqual(0);
        }
        // Some of the time it's standing still.
        expect(Array.from({ length: 200 }, (_, i) => wander(i / 200, legs, phase).walking).filter((x) => x === 0).length).toBeGreaterThan(40);
      }
  });
});
