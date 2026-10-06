import { describe, expect, it } from '@jest/globals';
import { BOTTOM, cleanLayouts, colsFor, HORIZON, meadow, moveTo, nearestSpot, placeResidents, ROW_HEIGHT, rowsFor, samePlacement, spotOrder } from '../gardenLayout';

describe('the meadow', () => {
  it('has three spots across on a phone and up to five on a wide page, always with a spare', () => {
    expect(colsFor(342)).toBe(3);
    expect(colsFor(592)).toBe(5);
    expect(colsFor(2000)).toBe(5);
    expect(colsFor(150)).toBe(2);
    expect(rowsFor(0, 3)).toBe(1);
    expect(rowsFor(2, 3)).toBe(1);
    expect(rowsFor(3, 3)).toBe(2);
    expect(rowsFor(11, 3)).toBe(4);
  });

  it('grows with its residents, each spot a little off its grid line', () => {
    const one = meadow(1, 342);
    expect(one.rows).toBe(1);
    expect(one.spots).toHaveLength(3);
    expect(one.height).toBe(HORIZON + ROW_HEIGHT + BOTTOM);
    const many = meadow(7, 342);
    expect(many.rows).toBe(3);
    expect(many.height).toBe(HORIZON + 3 * ROW_HEIGHT + BOTTOM);
    // Spots sit near their column centres and rows, never on top of each other.
    for (const s of many.spots) {
      expect(Math.abs(s.x - many.colWidth * (s.col + 0.5))).toBeLessThan(many.colWidth * 0.1);
      expect(Math.abs(s.y - (HORIZON + s.row * ROW_HEIGHT + 96))).toBeLessThanOrEqual(6);
    }
    expect(many.spots[0].depth).toBe(0);
    expect(many.spots[many.spots.length - 1].depth).toBe(1);
    // The same every time.
    expect(meadow(7, 342)).toEqual(many);
  });

  it('fills each row from the middle outwards', () => {
    expect(spotOrder(3, 2)).toEqual([1, 0, 2, 4, 3, 5]);
    expect(spotOrder(5, 1)).toEqual([2, 1, 3, 0, 4]);
    expect(spotOrder(2, 1)).toEqual([0, 1]);
  });
});

describe('placing residents', () => {
  const m = { cols: 3, rows: 2 };

  it('gives new arrivals the first free spots, keeps saved ones, and frees those who left', () => {
    expect(placeResidents(['a'], undefined, m)).toEqual({ a: 1 });
    expect(placeResidents(['a', 'b', 'c'], undefined, m)).toEqual({ a: 1, b: 0, c: 2 });
    // b was moved to the front row; a newcomer takes the spot that's free.
    expect(placeResidents(['new', 'a', 'b'], { a: 1, b: 4, gone: 0 }, m)).toEqual({ a: 1, b: 4, new: 0 });
  });

  it('drops a saved spot that no longer exists or is already taken', () => {
    expect(placeResidents(['a', 'b'], { a: 9, b: 2 }, m)).toEqual({ b: 2, a: 1 });
    expect(placeResidents(['a', 'b'], { a: 2, b: 2 }, m)).toEqual({ a: 2, b: 1 });
    expect(placeResidents(['a'], { a: -1 }, m)).toEqual({ a: 1 });
  });

  it('moves one to a spot, swapping with whoever stood there', () => {
    const p = { a: 1, b: 0, c: 2 };
    expect(moveTo(p, 'a', 4)).toEqual({ a: 4, b: 0, c: 2 });
    expect(moveTo(p, 'a', 0)).toEqual({ a: 0, b: 1, c: 2 });
    expect(moveTo(p, 'a', 1)).toEqual(p);
    expect(moveTo(p, 'nobody', 1)).toEqual(p);
  });

  it('finds the nearest spot to where something was dropped', () => {
    const spots = meadow(5, 342).spots;
    const s = spots[4];
    expect(nearestSpot(spots, s.x + 10, s.y - 20)).toBe(4);
    expect(nearestSpot(spots, -500, -500)).toBe(0);
  });

  it('knows when a placement is unchanged', () => {
    expect(samePlacement({ a: 1 }, { a: 1 })).toBe(true);
    expect(samePlacement({ a: 1 }, { a: 2 })).toBe(false);
    expect(samePlacement({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    expect(samePlacement(undefined, {})).toBe(false);
  });
});

describe('saved layouts', () => {
  it('reads back only well-formed accounts and spots', () => {
    expect(cleanLayouts(null)).toEqual({});
    expect(cleanLayouts({ u1: { a: 1, b: 2 }, guest: { starter: 0 } })).toEqual({ u1: { a: 1, b: 2 }, guest: { starter: 0 } });
    expect(cleanLayouts({ u1: { a: 1.5, b: -1, c: 'x', d: 3 }, bad: 5, '': { a: 1 } })).toEqual({ u1: { d: 3 } });
  });
});
