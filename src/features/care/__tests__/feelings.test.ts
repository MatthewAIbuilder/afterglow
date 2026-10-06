import { describe, expect, it } from '@jest/globals';
import { pulseAverage, PULSE_SPREAD } from '../body';
import {
  addEntry,
  cleanCare,
  clockShort,
  EMPTY_CARE,
  feelingsBetween,
  graphTimes,
  HAND_MOODS,
  HELP_MOODS,
  lastFeeling,
  lowestPoints,
  type Mood,
  MOOD_GROUPS,
  MOOD_LABEL,
  MOOD_LEVEL,
  MOOD_TIP,
  MOODS,
  needsHelp,
  nightSummary,
  recoveryFrom,
  recoveryLine,
} from '../care';
import { smoothPath } from '../curve';

// Saturday Dec 5 2026, 11:30 PM local.
const NOW = new Date(2026, 11, 5, 23, 30).getTime();
const MIN = 60_000;

describe('how you are feeling', () => {
  it('has a label, a level and a tip for every feeling', () => {
    expect(MOODS).toHaveLength(9);
    for (const m of MOODS) {
      expect(MOOD_LABEL[m]).toBeTruthy();
      expect(MOOD_TIP[m]).toBeTruthy();
      expect(MOOD_LEVEL[m]).toBeGreaterThanOrEqual(1);
      expect(MOOD_LEVEL[m]).toBeLessThanOrEqual(5);
    }
    for (const m of HELP_MOODS) expect(MOOD_LEVEL[m]).toBe(1);
  });

  it('puts help first after feeling sick, overwhelmed or not great', () => {
    for (const mood of HELP_MOODS) expect(needsHelp(addEntry(EMPTY_CARE, { kind: 'checkin', mood, at: NOW - 5 * MIN }), NOW)).toBe(true);
    for (const mood of ['tired', 'anxious', 'hot'] as const) expect(needsHelp(addEntry(EMPTY_CARE, { kind: 'checkin', mood, at: NOW - 5 * MIN }), NOW)).toBe(false);
  });

  it('knows your last feeling tonight, and the ones on a stopwatch', () => {
    let care = addEntry(EMPTY_CARE, { kind: 'checkin', mood: 'good', at: NOW - 20 * 60 * MIN });
    expect(lastFeeling(care, NOW)).toBeUndefined();
    care = addEntry(care, { kind: 'checkin', mood: 'great', at: NOW - 90 * MIN });
    care = addEntry(care, { kind: 'water', at: NOW - 60 * MIN });
    care = addEntry(care, { kind: 'checkin', mood: 'hot', at: NOW - 30 * MIN });
    expect(lastFeeling(care, NOW)).toEqual({ mood: 'hot', at: NOW - 30 * MIN });
    expect(feelingsBetween(care, NOW - 2 * 60 * MIN, NOW)).toEqual([
      { at: NOW - 90 * MIN, mood: 'great', level: 5 },
      { at: NOW - 30 * MIN, mood: 'hot', level: 2 },
    ]);
    expect(feelingsBetween(care, NOW - 45 * MIN, NOW)).toHaveLength(1);
  });

  it('keeps every feeling when read back, and drops unknown ones', () => {
    const raw = { log: [...MOODS.map((mood, i) => ({ kind: 'checkin', mood, at: NOW - (20 - i) * MIN })), { kind: 'checkin', mood: 'wavy', at: NOW }] };
    expect(cleanCare(raw, NOW).log.map((e) => (e.kind === 'checkin' ? e.mood : e.kind))).toEqual([...MOODS]);
  });
});

describe('pulse readings', () => {
  it('averages three readings and says when they disagree', () => {
    expect(pulseAverage([])).toBeUndefined();
    expect(pulseAverage([72, 76, 74])).toEqual({ bpm: 74, spread: 4, steady: true });
    const apart = pulseAverage([70, 70 + PULSE_SPREAD + 5, 80]);
    expect(apart?.steady).toBe(false);
  });
});

describe('the check-in card', () => {
  const at = (h: number, m = 0) => new Date(2026, 11, 5, h, m).getTime();
  const point = (mood: Mood, time: number) => ({ at: time, mood, level: MOOD_LEVEL[mood] });

  it('offers every feeling once, in its group, in the usual order', () => {
    expect(MOOD_GROUPS.map((g) => g.id)).toEqual(['fine', 'off', 'hand']);
    expect(MOOD_GROUPS.flatMap((g) => g.moods).sort()).toEqual([...MOODS].sort());
    expect(MOOD_GROUPS[0].moods).toEqual(['great', 'good', 'okay']);
    expect(MOOD_GROUPS[1]).toMatchObject({ title: 'Something’s off', moods: ['tired', 'anxious', 'hot', 'sick'] });
    expect(MOOD_GROUPS[2]).toMatchObject({ title: 'Need a hand', moods: ['overwhelmed', 'rough'] });
    for (const m of HAND_MOODS) expect(HELP_MOODS).toContain(m);
  });

  it('notices when you have felt better since a low point, and only then', () => {
    const night = [point('good', at(21)), point('hot', at(22, 30)), point('okay', at(23)), point('great', at(23, 45))];
    expect(recoveryFrom(night)).toEqual(night[1]);
    expect(recoveryLine(night[1])).toBe('You felt too hot at 10:30 PM, and you’ve been feeling better since.');
    expect(recoveryLine(point('rough', at(1, 5)))).toBe('You weren’t feeling great at 1:05 AM, and you’ve been feeling better since.');
    // Low right now, or never low: no note.
    expect(recoveryFrom([...night, point('anxious', at(23, 50))])).toBeUndefined();
    expect(recoveryFrom([point('good', at(21)), point('great', at(22))])).toBeUndefined();
    expect(recoveryFrom([])).toBeUndefined();
    // The latest low point is the one named.
    const twice = [point('sick', at(21)), point('good', at(22)), point('tired', at(23)), point('okay', at(23, 30))];
    expect(recoveryFrom(twice)).toEqual(twice[2]);
  });

  it('names the lowest moments, and says the night in words', () => {
    const night = [point('good', at(21)), point('hot', at(22, 30)), point('great', at(23, 45))];
    expect(lowestPoints(night)).toEqual([night[1]]);
    expect(lowestPoints([point('good', at(21)), point('good', at(22))])).toEqual([]);
    expect(nightSummary(night)).toBe('Tonight, 3 check-ins: 9 PM good, 10:30 PM too hot, 11:45 PM great.');
  });

  it('puts the first check-in, a couple of times between and now under the graph', () => {
    expect(clockShort(at(21))).toBe('9 PM');
    expect(clockShort(at(22, 30))).toBe('10:30');
    expect(clockShort(at(0, 15), true)).toBe('12:15 AM');
    expect(graphTimes(at(21), at(24)).map((t) => t.label)).toEqual(['9 PM', '10 PM', '11 PM', 'Now']);
    expect(graphTimes(at(21), at(23, 15)).map((t) => t.label)).toEqual(['9 PM', '9:45', '10:30', 'Now']);
    expect(graphTimes(at(21), at(21, 40)).map((t) => t.label)).toEqual(['9 PM', 'Now']);
    expect(graphTimes(at(21), at(21, 5)).map((t) => t.label)).toEqual(['9 PM']);
  });

  it('draws a smooth line through every check-in that never swings past them', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([{ x: 0, y: 10 }])).toBe('M0 10');
    const pts = [
      { x: 0, y: 20 },
      { x: 50, y: 80 },
      { x: 100, y: 60 },
      { x: 150, y: 10 },
    ];
    const d = smoothPath(pts);
    expect(d.startsWith('M0 20')).toBe(true);
    for (const p of pts.slice(1)) expect(d).toContain(` ${p.x} ${p.y}`);
    const ys = d
      .replace(/[MC]/g, ' ')
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...ys)).toBeLessThanOrEqual(80);
  });
});
