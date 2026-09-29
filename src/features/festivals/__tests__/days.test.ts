import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { dayList, daysOf, lineupDays, playsOn } from '../days';

const base: Festival = {
  id: 'f',
  name: 'F',
  dates: '',
  location: '',
  lineup: ['a', 'b', 'c', 'd'],
  days: ['Friday', 'Saturday', 'Sunday'],
  stages: [{ id: 'main', name: 'Main' }],
  artistDays: { a: ['Friday'], b: ['Sunday', 'Saturday'], c: ['Saturday'] },
};

describe('which day an artist plays', () => {
  it('reads the poster before set times, in festival order', () => {
    expect(daysOf(base, 'a')).toEqual(['Friday']);
    expect(daysOf(base, 'b')).toEqual(['Saturday', 'Sunday']);
    expect(daysOf(base, 'd')).toEqual([]);
  });

  it('lets set times, once out, have the last word', () => {
    const withSets: Festival = { ...base, sets: [{ artistId: 'a', day: 'Sunday', stageId: 'main', start: '21:00', end: '22:00' }] };
    expect(daysOf(withSets, 'a')).toEqual(['Sunday']);
    expect(daysOf(withSets, 'b')).toEqual(['Saturday', 'Sunday']);
  });

  it('says the days in plain words', () => {
    expect(dayList([])).toBeUndefined();
    expect(dayList(['Friday'])).toBe('Friday');
    expect(dayList(['Saturday', 'Sunday'])).toBe('Saturday and Sunday');
    expect(dayList(['Friday', 'Saturday', 'Sunday'])).toBe('Friday, Saturday and Sunday');
  });

  it('offers day filters only when most of the lineup has a day', () => {
    expect(lineupDays(base)).toEqual(['Friday', 'Saturday', 'Sunday']);
    expect(lineupDays({ ...base, artistDays: { a: ['Friday'] } })).toEqual([]);
    expect(lineupDays({ ...base, artistDays: { a: ['Friday'], b: ['Friday'], c: ['Friday'] } })).toEqual([]);
    expect(lineupDays({ ...base, days: ['Friday'] })).toEqual([]);
    expect(playsOn(base, 'b', 'Sunday')).toBe(true);
    expect(playsOn(base, 'a', 'Sunday')).toBe(false);
    expect(playsOn(base, 'd', undefined)).toBe(true);
  });
});
