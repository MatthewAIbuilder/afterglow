import { describe, expect, it } from '@jest/globals';
import { phaseAt, skyAt } from '../sky';

describe('the garden sky by the hour', () => {
  it('night, sunrise, day and dusk', () => {
    expect([0, 4, 5, 7, 8, 16, 17, 20, 21, 23].map(phaseAt)).toEqual(['night', 'night', 'dawn', 'dawn', 'day', 'day', 'dusk', 'dusk', 'night', 'night']);
    expect(phaseAt(-1)).toBe('night');
    expect(phaseAt(29)).toBe('dawn');
  });
  it('stars fade with the light, and night keeps the garden’s own glow', () => {
    expect(skyAt(2, '#abc')).toMatchObject({ glow: '#abc', stars: 1, washOpacity: 0 });
    expect(skyAt(12, '#abc').stars).toBeLessThan(skyAt(6, '#abc').stars);
    expect(skyAt(6, '#abc').wash).toBeTruthy();
  });
});
