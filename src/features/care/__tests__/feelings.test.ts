import { describe, expect, it } from '@jest/globals';
import { pulseAverage, PULSE_SPREAD } from '../body';
import { addEntry, cleanCare, EMPTY_CARE, feelingsBetween, HELP_MOODS, lastFeeling, MOOD_LABEL, MOOD_LEVEL, MOOD_TIP, MOODS, needsHelp } from '../care';

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
