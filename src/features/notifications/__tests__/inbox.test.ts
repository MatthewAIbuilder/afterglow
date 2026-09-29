import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { cleanRead, notices, unreadCount } from '../inbox';

const fest = (id: string, startDate?: string, endDate?: string, sets = false): Festival => ({
  id,
  name: id.toUpperCase(),
  dates: '',
  location: '',
  lineup: ['x'],
  days: ['fri'],
  stages: [{ id: 'main', name: 'Main' }],
  ...(startDate ? { startDate, endDate: endDate ?? startDate } : {}),
  ...(sets ? { sets: [{ artistId: 'x', day: 'fri', stageId: 'main', start: '22:00', end: '23:00' }] } : {}),
});
const today = new Date(2026, 8, 29, 12);

describe('the notifications bell', () => {
  it('has nothing for festivals you are not going to', () => {
    expect(notices([fest('a', '2026-09-30', undefined, true)], [], today)).toEqual([]);
  });

  it('says when set times are out for a festival you are going to', () => {
    const list = notices([fest('a', '2026-12-01', undefined, true), fest('b', '2026-12-01')], ['a', 'b'], today);
    expect(list.map((n) => [n.id, n.title])).toEqual([['sets:a', 'Set times are out for A']]);
  });

  it('says when a festival is close, or on', () => {
    const list = notices(
      [fest('soon', '2026-10-03'), fest('tomorrow', '2026-09-30', undefined, true), fest('on', '2026-09-28', '2026-09-30'), fest('far', '2026-11-20')],
      ['soon', 'tomorrow', 'on', 'far'],
      today,
    );
    expect(list.map((n) => n.title)).toEqual([
      'ON is happening now',
      'TOMORROW starts tomorrow',
      'SOON starts in 4 days',
      'Set times are out for TOMORROW',
    ]);
  });

  it('stops mentioning set times once the festival is over', () => {
    expect(notices([fest('done', '2026-06-01', '2026-06-03', true)], ['done'], today)).toEqual([]);
  });

  it('counts what you have not read', () => {
    const list = notices([fest('a', '2026-10-01', undefined, true)], ['a'], today);
    expect(unreadCount(list, new Set())).toBe(2);
    expect(unreadCount(list, new Set(['sets:a']))).toBe(1);
    expect(cleanRead(['a', 'a', 1, ''])).toEqual(['a']);
    expect(cleanRead('x')).toEqual([]);
  });
});
