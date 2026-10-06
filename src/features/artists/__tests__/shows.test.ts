import { describe, expect, it } from '@jest/globals';
import type { Show } from '../../../data/models';
import { localDay, showDateBlock, showDateSpoken, showLabel, showTitle, showWhere, withLine } from '../shows';

const club: Show = { id: 'edm-1', date: '2026-10-18', venue: 'Echostage', location: 'Washington, DC', link: 'https://edmtrain.com/x', artistIds: ['a'] };
const named: Show = { ...club, name: 'Wasteland Halloween' };

describe('artist show words', () => {
  it('writes the date block and the spoken date', () => {
    expect(showDateBlock('2026-10-18')).toEqual({ month: 'OCT', day: '18', weekday: 'Sun' });
    expect(showDateSpoken('2026-10-18')).toBe('Sunday 18 October');
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('names a show by its event, else its venue', () => {
    expect(showTitle(club)).toBe('Echostage');
    expect(showWhere(club)).toBe('Washington, DC');
    expect(showTitle(named)).toBe('Wasteland Halloween');
    expect(showWhere(named)).toBe('Echostage, Washington, DC');
    expect(showWhere({ ...club, location: '' })).toBe('');
  });

  it('says who else plays', () => {
    expect(withLine([])).toBeUndefined();
    expect(withLine(['Fred again..'])).toBe('with Fred again..');
    expect(withLine(['A', 'B'])).toBe('with A and B');
    expect(withLine(['A', 'B', 'C'])).toBe('with A, B and C');
    expect(withLine(['A', 'B', 'C', 'D'])).toBe('with A, B and 2 more');
    expect(showLabel(named, ['Crankdat'])).toBe(
      'Wasteland Halloween, Sunday 18 October. Echostage, Washington, DC. With Crankdat. Opens the show.',
    );
    expect(showLabel(club, [])).toBe('Echostage, Sunday 18 October. Washington, DC. Opens the show.');
  });
});
