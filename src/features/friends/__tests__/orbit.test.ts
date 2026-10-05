import { describe, expect, it } from '@jest/globals';
import { chatTime, crewOrbPlaces, ringPlaces, splitOrbit } from '../orbit';

const people = (ids: string[]) => ids.map((uid) => ({ uid }));

describe('the friends orbit', () => {
  it('puts close friends on the inner ring in the order starred, everyone else outside', () => {
    const { inner, outer, more } = splitOrbit(people(['a', 'b', 'c', 'd']), ['c', 'x', 'a'], 6, 10);
    expect(inner.map((p) => p.uid)).toEqual(['c', 'a']);
    expect(outer.map((p) => p.uid)).toEqual(['b', 'd']);
    expect(more).toBe(0);
  });

  it('caps each ring and counts who did not fit', () => {
    const many = people(Array.from({ length: 20 }, (_, i) => `p${i}`));
    const { inner, outer, more } = splitOrbit(many, ['p0', 'p1', 'p2'], 2, 5);
    expect(inner).toHaveLength(2);
    expect(outer).toHaveLength(5);
    expect(more).toBe(13);
  });

  it('spaces faces evenly round a ring', () => {
    const places = ringPlaces(4, 30, 0);
    expect(places.map((p) => Math.round((p.angle * 180) / Math.PI))).toEqual([0, 90, 180, 270]);
    expect(places.every((p) => p.size === 30)).toBe(true);
    expect(ringPlaces(0, 30)).toEqual([]);
  });
});

describe('a crew’s picture', () => {
  it('fits up to four faces inside the picture', () => {
    for (const n of [1, 2, 3, 4, 7]) {
      const places = crewOrbPlaces(n, 64);
      expect(places).toHaveLength(Math.min(n, 4));
      for (const p of places) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.size).toBeLessThanOrEqual(64);
        expect(p.y + p.size).toBeLessThanOrEqual(64);
      }
    }
    expect(crewOrbPlaces(0, 64)).toEqual([]);
  });
});

describe('chat times', () => {
  const now = Date.UTC(2026, 9, 5, 18, 0);
  it('is short, like a messages list', () => {
    expect(chatTime(now - 20_000, now)).toBe('now');
    expect(chatTime(now - 4 * 60_000, now)).toBe('4m');
    expect(chatTime(now - 3 * 3_600_000, now)).toBe('3h');
    expect(chatTime(now - 2 * 86_400_000, now)).toMatch(/^[A-Z][a-z]{2}$/);
    expect(chatTime(now - 30 * 86_400_000, now)).toMatch(/\d/);
  });
});
