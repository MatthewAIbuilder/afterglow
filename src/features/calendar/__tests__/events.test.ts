import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { festivalEvent, icsFileName, icsFor, icsText, localDay, nextDay } from '../events';

const fest = (over: Partial<Festival> = {}) =>
  ({ id: 'edc-orlando-26', name: 'EDC Orlando 2026', dates: 'Nov 6 to 8', location: 'Tinker Field, Orlando', lineup: [], days: [], stages: [], startDate: '2026-11-06', endDate: '2026-11-08', ...over }) as Festival;

describe('festival calendar events', () => {
  it('all its days, at its place, linking back', () => {
    expect(festivalEvent(fest(), 'https://afterglowmusic.app')).toEqual({
      title: 'EDC Orlando 2026',
      startDay: '2026-11-06',
      endDay: '2026-11-08',
      location: 'Tinker Field, Orlando',
      notes: 'Your lineup and plan: https://afterglowmusic.app/festival/edc-orlando-26',
      url: 'https://afterglowmusic.app/festival/edc-orlando-26',
    });
  });

  it('nothing without real dates; a missing end is one day', () => {
    expect(festivalEvent(fest({ startDate: undefined }), 'x')).toBeUndefined();
    expect(festivalEvent(fest({ startDate: 'soon' }), 'x')).toBeUndefined();
    expect(festivalEvent(fest({ endDate: undefined }), 'x')!.endDay).toBe('2026-11-06');
  });

  it('local days and the day after, across months and years', () => {
    expect(localDay('2026-12-31').getDate()).toBe(31);
    expect(nextDay('2026-12-31')).toBe('20270101');
    expect(nextDay('2026-02-28')).toBe('20260301');
  });

  it('a valid .ics file: all-day, end the morning after, text escaped', () => {
    const ics = icsFor(festivalEvent(fest(), 'https://afterglowmusic.app')!, new Date('2026-09-30T12:00:00.000Z'), 'edc-orlando-26');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261106\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20261109\r\n');
    expect(ics).toContain('LOCATION:Tinker Field\\, Orlando\r\n');
    expect(ics).toContain('DTSTAMP:20260930T120000Z\r\n');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    // A semicolon, a line break and a backslash, each escaped with a backslash.
    const bs = '\\';
    expect(icsText(`a;b\nc${bs}`)).toBe(`a${bs};b${bs}nc${bs}${bs}`);
    expect(icsFileName('RÜFÜS Fest: 2026!')).toBe('rufus-fest-2026.ics');
  });
});
