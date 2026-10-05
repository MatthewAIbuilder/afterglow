import { describe, expect, it } from '@jest/globals';
import { fadeCss, fadeStops } from '../fadeStops';

describe('fade masks', () => {
  it('fades out below `bottom` only, for the top of a profile', () => {
    expect(fadeStops(0, 0.7)).toEqual({ colors: ['#000', '#000', '#000', 'transparent'], locations: [0, 0, 0.7, 1] });
    expect(fadeCss(0, 0.7)).toBe('linear-gradient(to bottom, #000 0%, #000 0%, #000 70%, transparent 100%)');
  });

  it('fades both ends behind an orbit, and keeps the stops in order', () => {
    expect(fadeStops(0.3, 0.7).colors).toEqual(['transparent', '#000', '#000', 'transparent']);
    expect(fadeStops(0.8, 0.2).locations).toEqual([0, 0.8, 0.8, 1]);
  });
});
