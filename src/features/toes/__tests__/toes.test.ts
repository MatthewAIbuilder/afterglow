import { describe, expect, it } from '@jest/globals';
import { hasToes, TOE_FRIENDS, toeConstellation } from '../toes';

describe('toes', () => {
  it('belong to one account only', () => {
    expect(TOE_FRIENDS).toEqual(['QdMqoH4PeEfvkBmiKAzdnWyBUlL2']);
    expect(hasToes('QdMqoH4PeEfvkBmiKAzdnWyBUlL2')).toBe(true);
    expect(hasToes('someone-else')).toBe(false);
    expect(hasToes(undefined)).toBe(false);
    expect(hasToes(null)).toBe(false);
    expect(hasToes('')).toBe(false);
  });

  it('draw a footprint in stars: five toes, big to little, above the sole', () => {
    const { toes, sole } = toeConstellation(100, 200, 50);
    expect(toes).toHaveLength(5);
    for (let i = 1; i < 5; i++) expect(toes[i].r).toBeLessThan(toes[i - 1].r);
    const lowestToe = Math.max(...toes.map((t) => t.y));
    expect(Math.max(...sole.map((s) => s.y))).toBeGreaterThan(lowestToe);
    for (const p of [...toes, ...sole]) {
      expect(Math.abs(p.x - 100)).toBeLessThanOrEqual(25);
      expect(Math.abs(p.y - 200)).toBeLessThanOrEqual(25);
    }
  });
});
