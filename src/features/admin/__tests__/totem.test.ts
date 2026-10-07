import { describe, expect, it } from '@jest/globals';
import { clock, cleanTotem, DEFAULT_TOTEM, totemNext, totemPopup } from '../totem';

const s = { codes: ['aaaaaa1', 'bbbbbb2'], everyMin: 5, showSec: 60 };
const min = 60_000;

describe('the totem', () => {
  it('shows the logo, then after each gap a sticker in turn for a minute', () => {
    expect(totemPopup(s, 0, 4 * min)).toBeUndefined();
    expect(totemPopup(s, 0, 5 * min)).toEqual({ code: 'aaaaaa1', index: 0, left: 60 });
    expect(totemPopup(s, 0, 5 * min + 45_000)).toMatchObject({ code: 'aaaaaa1', left: 15 });
    expect(totemPopup(s, 0, 6 * min)).toBeUndefined();
    expect(totemPopup(s, 0, 10 * min + 1000)).toMatchObject({ code: 'bbbbbb2', index: 1 });
    expect(totemPopup(s, 0, 15 * min)).toMatchObject({ code: 'aaaaaa1' });
    expect(totemPopup({ ...s, codes: [] }, 0, 5 * min)).toBeUndefined();
  });

  it('knows which comes next and when', () => {
    expect(totemNext(s, 0, 0)).toEqual({ code: 'aaaaaa1', inSec: 300 });
    expect(totemNext(s, 0, 4 * min + 55_000)).toEqual({ code: 'aaaaaa1', inSec: 5 });
    // While one is up, the teaser is already on the one after.
    expect(totemNext(s, 0, 5 * min + 10_000)).toEqual({ code: 'bbbbbb2', inSec: 290 });
    expect(totemNext({ ...s, codes: [] }, 0, 0)).toBeUndefined();
    expect(clock(245)).toBe('4:05');
    expect(clock(9)).toBe('0:09');
  });

  it('“Pop one now” brings one up straight away', () => {
    expect(totemPopup(s, 0, 2 * min, 2 * min)).toMatchObject({ code: 'aaaaaa1', left: 60 });
    expect(totemPopup(s, 0, 3 * min + 1, 2 * min)).toBeUndefined();
  });

  it('reads its settings back safely', () => {
    expect(cleanTotem(undefined)).toEqual(DEFAULT_TOTEM);
    expect(cleanTotem({ brand: 'underground-alchemy', subtitle: '  Lost   Lands ', codes: ['aaaaaa1', 'aaaaaa1', 'BAD!', 3], everyMin: 1, showSec: 120 })).toEqual({
      brand: 'underground-alchemy',
      subtitle: 'Lost Lands',
      codes: ['aaaaaa1'],
      everyMin: 1,
      showSec: 30,
    });
    expect(cleanTotem({ everyMin: 7, showSec: 5 })).toMatchObject({ everyMin: 5, showSec: 60 });
  });
});
