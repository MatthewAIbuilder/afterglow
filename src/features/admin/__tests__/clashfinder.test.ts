import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival } from '../../../data/models';
import { findClashfinder, nameWords, publicKeyInput, readClashfinder, type ClashfinderEvent, type ClashfinderSummary } from '../clashfinder';
import { decide } from '../pageSetTimes';

const at = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 1000;
const festival = (over: Partial<Festival> = {}): Festival =>
  ({ id: 'edc-orlando-26', name: 'EDC Orlando 2026', dates: 'Nov 6 to 8', location: 'Tinker Field, Orlando', startDate: '2026-11-06', endDate: '2026-11-08', days: [], stages: [], lineup: [], ...over }) as Festival;
const artist = (id: string, name: string) => ({ id, name }) as Artist;

describe('Clashfinder set times', () => {
  it('signs requests with the username and private key, as Clashfinder’s page shows', () => {
    expect(publicKeyInput('matthews142', 'secret')).toBe('matthews142secret');
  });

  it('finds the festival’s clashfinder by name and date, preferring Clashfinder’s own pick, then the fullest', () => {
    const all: Record<string, ClashfinderSummary> = {
      edco25: { name: 'edcorlando2025', desc: 'EDCO 2025', startDate: at('2025-11-07'), numActs: 121 },
      fan: { name: 'edcorlando2026', desc: 'EDC Orlando 2026', startDate: at('2026-11-06'), numActs: 90, edits: 3 },
      fuller: { name: 'edco26full', desc: 'EDC Orlando 2026', startDate: at('2026-11-06'), numActs: 130, edits: 9 },
      other: { name: 'edclv2026', desc: 'EDC Las Vegas 2026', startDate: at('2026-11-06'), numActs: 300 },
      hidden: { name: 'mine', desc: 'EDC Orlando 2026', startDate: at('2026-11-06'), numActs: 500, private: true },
    };
    expect(findClashfinder(festival(), all)?.name).toBe('edco26full');
    expect(findClashfinder(festival(), { ...all, core: { name: 'edcocore', desc: 'EDC Orlando 2026', startDate: at('2026-11-06'), numActs: 10, coreClashfinder: true } })?.name).toBe('edcocore');
    // Last year's, or another EDC, is never it.
    expect(findClashfinder(festival(), { edco25: all.edco25, other: all.other })).toBeUndefined();
    // A day either side still counts (time zones); a week doesn't.
    expect(findClashfinder(festival(), { x: { ...all.fan, startDate: at('2026-11-05') } })?.name).toBe('edcorlando2026');
    expect(findClashfinder(festival(), { x: { ...all.fan, startDate: at('2026-11-13') } })).toBeUndefined();
    expect(nameWords('Lost Lands Festival 2026')).toEqual(['lost', 'lands']);
  });

  it('reads stages and times, keeps late sets on their night, and matches only artists on Afterglow', () => {
    const data: ClashfinderEvent = {
      timezone: 'US/Eastern',
      locations: [
        {
          name: 'Kinetic Field',
          events: [
            { name: 'Subtronics', start: '2026-11-06 22:00', end: '2026-11-06 23:15' },
            { name: 'ILLENIUM', start: '2026-11-07 00:30', end: '2026-11-07 01:45' },
            { name: 'Someone New', start: '2026-11-06 20:00', end: '2026-11-06 21:00' },
          ],
        },
        { name: 'neonGARDEN', events: [{ name: 'Bob Moses (Club Set)', start: '2026-11-08 18:00', end: '2026-11-08 19:30' }, { name: 'broken' }] },
      ],
    };
    const f = festival({ stages: [{ id: 'kinetic', name: 'kineticFIELD' }], lineup: ['subtronics', 'illenium', 'bob-moses'] });
    const r = readClashfinder(data, f, [artist('subtronics', 'Subtronics'), artist('illenium', 'Illenium'), artist('bob-moses', 'Bob Moses')])!;
    expect(r.lineup.sets).toEqual([
      { artistId: 'subtronics', day: 'Friday', stageId: 'kinetic', start: '22:00', end: '23:15' },
      // 00:30 on Saturday's date is still Friday night.
      { artistId: 'illenium', day: 'Friday', stageId: 'kinetic', start: '00:30', end: '01:45' },
      { artistId: 'bob-moses', day: 'Sunday', stageId: 'neongarden', start: '18:00', end: '19:30' },
    ]);
    expect(r.lineup.days).toEqual(['Friday', 'Sunday']);
    expect(r.lineup.stages).toEqual([{ id: 'kinetic', name: 'kineticFIELD' }, { id: 'neongarden', name: 'neonGARDEN' }]);
    expect(r.lineup.source).toBe('page');
    expect([r.read, r.kept, r.unknown, r.unread, r.coverage]).toEqual([4, 3, ['Someone New'], 1, 1]);
    // Too few sets to publish on their own: the same checks as an official page.
    expect(decide(r).publish).toBe(false);
  });

  it('names days the festival’s own way, and leaves out sets on days it doesn’t have', () => {
    const data: ClashfinderEvent = {
      locations: [
        {
          name: 'Main',
          events: [
            { name: 'Subtronics', start: '2026-11-06 22:00', end: '2026-11-06 23:00' },
            { name: 'Illenium', start: '2026-11-09 22:00', end: '2026-11-09 23:00' },
          ],
        },
      ],
    };
    const f = festival({ days: ['Day 1', 'Day 2', 'Day 3'], lineup: ['subtronics', 'illenium'] });
    const r = readClashfinder(data, f, [artist('subtronics', 'Subtronics'), artist('illenium', 'Illenium')])!;
    expect(r.lineup.sets?.map((s) => s.day)).toEqual(['Day 1']);
    expect(r.noDay).toBe(1);
    expect(readClashfinder({ locations: [] }, f, [])).toBeUndefined();
  });
});
