import { describe, expect, it, jest } from '@jest/globals';

import type { Festival } from '../../data/models';

// A phone set to Mexican Spanish. The language is worked out once as the app starts, so start afresh.
jest.resetModules();
jest.doMock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'es-MX', languageCode: 'es', regionCode: 'MX' }],
}));
/* eslint-disable @typescript-eslint/no-require-imports */
const { LANGUAGE, LANGUAGE_CHOICE, t, tc, tn } = require('..') as typeof import('..');
const { datesLine, formatTime, whereWhen } = require('../../features/festivals/format') as typeof import('../../features/festivals/format');
const { runLabel } = require('../../features/festivals/weekend') as typeof import('../../features/festivals/weekend');
const { countdown } = require('../../features/festivals/when') as typeof import('../../features/festivals/when');
const { dateBlock } = require('../../features/festivals/timeline') as typeof import('../../features/festivals/timeline');
/* eslint-enable @typescript-eslint/no-require-imports */

describe('on a phone set to Spanish', () => {
  it('speaks Spanish, following the phone', () => {
    expect(LANGUAGE_CHOICE).toBe('device');
    expect(LANGUAGE).toBe('es');
    expect(t('Settings')).toBe('Ajustes');
    expect(tn(1, '{n} new reply', '{n} new replies')).toBe('1 respuesta nueva');
    expect(tn(3, '{n} new reply', '{n} new replies')).toBe('3 respuestas nuevas');
    expect(t('A line nobody translated')).toBe('A line nobody translated');
    // One English word, two meanings.
    expect(t('Leave')).toBe('Salir');
    expect(tc('time', 'Leave')).toBe('Salida');
    expect(tc('nothing', 'Leave')).toBe('Salir');

  });

  it('writes dates and times the Spanish way', () => {
    expect(runLabel({ start: '2026-10-09', end: '2026-10-11' })).toBe('9 al 11 de oct');
    expect(runLabel({ start: '2026-10-30', end: '2026-11-01' })).toBe('30 de oct al 1 de nov');
    expect(formatTime('23:40')).toBe('23:40');
    expect(formatTime('09:05')).toBe('9:05');
    const f = { dates: 'Nov 6 to 8', startDate: '2026-11-06', endDate: '2026-11-08', location: 'Orlando' } as Festival;
    expect(datesLine(f)).toBe('6 al 8 de nov');
    expect(whereWhen(f)).toBe('6 al 8 de nov, Orlando');
    // No dates to work from: the catalogue's own words.
    expect(datesLine({ dates: 'Summer' })).toBe('Summer');
    expect(dateBlock(f)).toEqual({ month: 'NOV', days: '6–8' });
    expect(countdown({ ...f, days: [] } as Festival, new Date(2026, 10, 1))).toBe('En 5 días');
  });
});
