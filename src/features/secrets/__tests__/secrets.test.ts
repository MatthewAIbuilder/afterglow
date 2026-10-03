import { describe, expect, it } from '@jest/globals';
import { SECRETS, cleanFound, isSunriseHour, searchSecret, secretsLine, shakeStep, tapStep } from '../secrets';

describe('secrets', () => {
  it('knows the secret word, however it’s typed', () => {
    expect(searchSecret('PLUR')).toBe('plur');
    expect(searchSecret(' p.l.u.r ')).toBe('plur');
    expect(searchSecret('Peace, love, unity, respect')).toBe('plur');
    expect(searchSecret('plu')).toBeUndefined();
  });

  it('tells a shake from a wobble', () => {
    let jolts: number[] = [];
    const g = (t: number, x: number) => {
      const r = shakeStep(jolts, { x, y: 0, z: 0, t });
      jolts = r.jolts;
      return r.shook;
    };
    // Gravity alone, a long wobble, then three sharp jolts.
    // Gravity alone, then a run's footfalls (about 2.5 g in all), then three sharp jolts.
    expect(g(0, 1)).toBe(false);
    expect(g(50, 2.5)).toBe(false);
    expect(g(400, 2.5)).toBe(false);
    expect(g(750, 2.5)).toBe(false);
    expect(g(1000, 3.1)).toBe(false);
    expect(g(1050, 3.1)).toBe(false); // too soon after the last: the same jolt
    expect(g(1300, 3.2)).toBe(false);
    expect(g(1600, 3.3)).toBe(true);
    // A shake is used up: it takes three more.
    expect(g(1800, 3.3)).toBe(false);
    // Jolts too far apart never add up.
    jolts = [];
    expect(g(5000, 3)).toBe(false);
    expect(g(6000, 3)).toBe(false);
    expect(g(7000, 3)).toBe(false);
  });

  it('counts quick taps in a row', () => {
    let taps: number[] = [];
    let done = false;
    for (let i = 0; i < 7; i++) {
      const r = tapStep(taps, i * 300);
      taps = r.taps;
      done = r.done;
    }
    expect(done).toBe(true);
    // A pause starts again.
    taps = [];
    for (let i = 0; i < 6; i++) taps = tapStep(taps, i * 300).taps;
    expect(tapStep(taps, 6 * 300 + 2000).done).toBe(false);
  });

  it('dawn is 5 to 7', () => {
    expect(isSunriseHour(new Date(2026, 9, 3, 5, 30).getTime())).toBe(true);
    expect(isSunriseHour(new Date(2026, 9, 3, 7, 0).getTime())).toBe(false);
    expect(isSunriseHour(new Date(2026, 9, 3, 23, 0).getTime())).toBe(false);
  });

  it('reads found secrets back', () => {
    expect(cleanFound({ plur: 5, nope: 3, lightshow: 'x', edge: -1 })).toEqual({ plur: 5 });
    expect(cleanFound(null)).toEqual({});
    expect(secretsLine(2)).toBe(`2 of ${SECRETS.length} secrets found`);
    expect(secretsLine(SECRETS.length)).toBe(`All ${SECRETS.length} secrets found`);
  });
});
