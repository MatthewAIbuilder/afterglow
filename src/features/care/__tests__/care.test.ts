import { describe, expect, it } from '@jest/globals';
import { addEntry, cardLine, cleanCare, countTonight, elapsed, EMPTY_CARE, emergencyNumber, KEEP_MS, lastLine, needsHelp, nightStart, regionOf, startTimer, stopTimer, TIMERS_MAX, undoLast } from '../care';

// Saturday Dec 5 2026, 11:30 PM local.
const NOW = new Date(2026, 11, 5, 23, 30).getTime();
const MIN = 60_000;

describe('look after yourself', () => {
  it('runs timers in your own words, a few at once', () => {
    let care = startTimer(EMPTY_CARE, '  first   one ', NOW - 72 * MIN, 'a');
    care = startTimer(care, '', NOW - 5 * MIN, 'b');
    expect(care.timers.map((t) => t.label)).toEqual(['first one', '']);
    expect(elapsed(NOW - care.timers[0].startedAt)).toBe('1 h 12 min');
    expect(stopTimer(care, 'a').timers.map((t) => t.id)).toEqual(['b']);
    let full = EMPTY_CARE;
    for (let i = 0; i < TIMERS_MAX + 2; i++) full = startTimer(full, `t${i}`, NOW, `id${i}`);
    expect(full.timers).toHaveLength(TIMERS_MAX);
  });

  it('reads elapsed time at a glance', () => {
    expect([elapsed(20_000), elapsed(12 * MIN), elapsed(60 * MIN), elapsed(185 * MIN)]).toEqual(['Just now', '12 min', '1 h', '3 h 5 min']);
  });

  it('counts water and food since tonight began (noon), and takes back a mistaken tap', () => {
    let care = addEntry(EMPTY_CARE, { kind: 'water', at: NOW - 13 * 60 * MIN }); // yesterday's night
    care = addEntry(care, { kind: 'water', at: NOW - 90 * MIN });
    care = addEntry(care, { kind: 'water', at: NOW - 40 * MIN });
    care = addEntry(care, { kind: 'food', at: NOW - 3 * 60 * MIN });
    expect(nightStart(NOW)).toBe(new Date(2026, 11, 5, 12).getTime());
    expect(nightStart(new Date(2026, 11, 6, 2).getTime())).toBe(new Date(2026, 11, 5, 12).getTime());
    expect(countTonight(care, 'water', NOW)).toBe(2);
    expect(lastLine(care, 'water', NOW)).toBe('Last 40 min ago');
    expect(lastLine(EMPTY_CARE, 'food', NOW)).toBe('None yet tonight');
    expect(countTonight(undoLast(care, 'water'), 'water', NOW)).toBe(1);
    expect(undoLast(EMPTY_CARE, 'food')).toBe(EMPTY_CARE);
  });

  it('puts help first after a "not great" check-in tonight', () => {
    const rough = addEntry(EMPTY_CARE, { kind: 'checkin', mood: 'rough', at: NOW - 5 * MIN });
    expect(needsHelp(rough, NOW)).toBe(true);
    expect(needsHelp(addEntry(rough, { kind: 'checkin', mood: 'good', at: NOW }), NOW)).toBe(false);
    expect(needsHelp(rough, NOW + 24 * 60 * MIN)).toBe(false);
  });

  it('sums it up for the festival page card', () => {
    let care = startTimer(EMPTY_CARE, 'since doors', NOW - 72 * MIN, 'a');
    care = addEntry(care, { kind: 'water', at: NOW - 40 * MIN });
    expect(cardLine(care, NOW)).toBe('Since doors 1 h 12 min · water 40 min ago');
    expect(cardLine(EMPTY_CARE, NOW)).toBe('Stopwatches, water and check-ins, private to you');
  });

  it('knows the emergency number from the phone’s region', () => {
    expect([regionOf('en-US'), regionOf('en-Latn-US'), regionOf('fr_FR'), regionOf('es-419'), regionOf(undefined)]).toEqual(['US', 'US', 'FR', undefined, undefined]);
    expect(['US', 'CA', 'GB', 'AU', 'NZ', 'DE', undefined].map(emergencyNumber)).toEqual(['911', '911', '999', '000', '111', '112', '112']);
  });

  it('reads saved notes back safely and lets old nights go', () => {
    const raw = {
      timers: [{ id: 'a', label: 'x', startedAt: NOW - MIN }, { id: 'old', label: 'y', startedAt: NOW - KEEP_MS - MIN }, { nope: true }],
      log: [{ kind: 'water', at: NOW - MIN }, { kind: 'checkin', mood: 'great', at: NOW }, { kind: 'food', at: 'soon' }, { kind: 'checkin', mood: 'meh', at: NOW }],
      lock: true,
    };
    const care = cleanCare(raw, NOW);
    expect(care.timers.map((t) => t.id)).toEqual(['a']);
    expect(care.log.map((e) => e.kind)).toEqual(['water', 'checkin']);
    expect(care.lock).toBe(true);
    expect(cleanCare('junk', NOW)).toEqual(EMPTY_CARE);
    // Oldest first, whatever order they were saved in, so "last" is the newest.
    const unordered = cleanCare({ log: [{ kind: 'water', at: NOW - 40 * MIN }, { kind: 'water', at: NOW - 100 * MIN }] }, NOW);
    expect(lastLine(unordered, 'water', NOW)).toBe('Last 40 min ago');
  });
});
