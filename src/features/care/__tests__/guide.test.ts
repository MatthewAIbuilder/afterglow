import { describe, expect, it } from '@jest/globals';
import { bpmFromTaps, currentTaps, pulseNote, stepsLine } from '../body';
import { cleanCare, EMPTY_CARE, lastDose, startTimer, tookMore } from '../care';
import { GUIDE, guideEntry, MIXES, phaseAt, rangeText, riskyMixes, stopwatchText, tooSoon, tooSoonLine, upTo } from '../guide';

const NOW = Date.parse('2026-12-05T22:00:00');
const MIN = 60_000;

describe('timing guide', () => {
  it('is consistent: starts before it peaks before it wears off, mixes name real entries, and never mentions amounts', () => {
    for (const g of GUIDE) {
      expect(g.onset[0]).toBeLessThanOrEqual(g.onset[1]);
      expect(g.onset[1]).toBeLessThanOrEqual(g.peak[1]);
      expect(g.peak[1]).toBeLessThanOrEqual(g.total[1]);
      expect(g.tips.length).toBeGreaterThan(0);
      // No doses: no milligrams, grams, pills counts or "dose" anywhere.
      expect([g.name, g.how, ...g.tips].join(' ')).not.toMatch(/\b\d+\s?(mg|g|ml|µg|ug|mcg)\b|\bdose/i);
    }
    for (const m of MIXES) expect(guideEntry(m.a) && guideEntry(m.b)).toBeTruthy();
  });

  it('says where you probably are, and that not feeling it yet is normal', () => {
    const mdma = guideEntry('mdma')!;
    expect(phaseAt(mdma, 10)).toMatchObject({ phase: 'waiting', line: 'Usually starts in 30 to 90 min. Not feeling it yet is normal.' });
    expect(phaseAt(mdma, 45)).toMatchObject({ phase: 'coming-up', line: 'It can take up to 90 min. Wait before taking any more.' });
    expect(phaseAt(mdma, 120)?.phase).toBe('peak');
    expect(phaseAt(mdma, 240)).toMatchObject({ phase: 'wearing-off', line: 'It usually lasts 4 to 6 h in all.' });
    expect(phaseAt(mdma, 400)).toMatchObject({ phase: 'after', progress: 1 });
    expect(phaseAt(undefined, 10)).toBeUndefined();
  });

  it('warns before taking more too soon', () => {
    const edible = guideEntry('edible')!;
    expect(tooSoon(edible, 60)).toBe(true);
    expect(tooSoon(edible, 130)).toBe(false);
    expect(tooSoon(undefined, 60)).toBe(true);
    expect(tooSoonLine(edible, 60)).toBe('It’s only been 60 min. Cannabis edible can take up to 2 h to start. Taking more before it’s kicked in is one of the most common ways people get hurt.');
  });

  it('flags risky mixes among what you started, once each', () => {
    expect(riskyMixes(['ghb', 'alcohol', 'mdma']).map((m) => `${m.a.id}+${m.b.id}`)).toEqual(['ghb+alcohol', 'mdma+alcohol']);
    expect(riskyMixes(['mushrooms'])).toEqual([]);
  });

  it('reads times plainly', () => {
    expect([rangeText([30, 90]), rangeText([240, 360]), rangeText([45, 120]), rangeText([0, 1]), upTo(120), upTo(15)]).toEqual([
      '30 to 90 min',
      '4 to 6 h',
      '45 min to 2 h',
      'under a minute',
      '2 h',
      '15 min',
    ]);
    expect([stopwatchText(0), stopwatchText(65_000), stopwatchText(3_725_000)]).toEqual(['0:00', '1:05', '1:02:05']);
  });
});

describe('stopwatches', () => {
  it('keeps the guide and every time you took more, read back safely', () => {
    let care = startTimer(EMPTY_CARE, 'MDMA / molly', NOW - 120 * MIN, 'a', 'mdma');
    care = tookMore(care, 'a', NOW - 10 * MIN);
    expect(lastDose(care.timers[0])).toBe(NOW - 10 * MIN);
    expect(cleanCare(JSON.parse(JSON.stringify(care)), NOW).timers[0]).toEqual({ id: 'a', label: 'MDMA / molly', startedAt: NOW - 120 * MIN, guide: 'mdma', doses: [NOW - 10 * MIN] });
    expect(cleanCare({ timers: [{ id: 'b', label: 'x', startedAt: NOW, guide: 'DROP TABLE', doses: ['x', NOW - 999 * 24 * 60 * MIN] }] }, NOW).timers[0]).toEqual({ id: 'b', label: 'x', startedAt: NOW });
  });
});

describe('your body', () => {
  it('works out a pulse from taps, ignoring stray ones', () => {
    const taps = Array.from({ length: 10 }, (_, i) => i * 750); // 80 a minute
    expect(bpmFromTaps(taps)).toBe(80);
    expect(bpmFromTaps(taps.slice(0, 5))).toBeUndefined();
    expect(bpmFromTaps([...taps, 7500 + 90])).toBe(80);
    expect(currentTaps([0, 700, 5000, 5700], 6000)).toEqual([5000, 5700]);
    expect(currentTaps([0, 700], 9000)).toEqual([]);
  });

  it('says plainly when a pulse is a reason to get help', () => {
    expect(pulseNote(72).tone).toBe('ok');
    expect(pulseNote(108).tone).toBe('watch');
    expect(pulseNote(130).tone).toBe('help');
    expect(pulseNote(44).tone).toBe('watch');
  });

  it('turns steps into distance', () => {
    expect(stepsLine(12480, false)).toBe('12,480 steps · about 9.4 km');
    expect(stepsLine(12480, true)).toBe('12,480 steps · about 5.8 mi');
  });
});
