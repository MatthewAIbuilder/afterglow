import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { setTimesExpected } from '../setTimes';

const fest = (over: Partial<Festival> = {}) =>
  ({ id: 'f', name: 'F', dates: '', location: '', lineup: [], days: [], stages: [], startDate: '2026-12-04', endDate: '2026-12-06', ...over }) as Festival;
const day = (iso: string) => new Date(`${iso}T12:00:00`);

describe('when set times might come out', () => {
  it('names the window well ahead', () => {
    expect(setTimesExpected(fest(), day('2026-10-01'))).toBe('Set times usually come out a week or two before. Look out around Nov 20 to 27.');
    expect(setTimesExpected(fest({ startDate: '2026-12-10' }), day('2026-10-01'))).toBe(
      'Set times usually come out a week or two before. Look out around Nov 26 to Dec 3.',
    );
  });

  it('says any day now, then usually out by now, mentioning the bell when you’re going', () => {
    expect(setTimesExpected(fest(), day('2026-11-22'))).toBe('Set times could come out any day now.');
    expect(setTimesExpected(fest(), day('2026-11-30'), true)).toBe(
      'Set times are usually out by now. Your picks turn into a schedule the moment they are. You’ll get a note in the bell when they’re out.',
    );
  });

  it('says nothing once set times are out, without dates, or once it’s started', () => {
    expect(setTimesExpected(fest({ sets: [{ artistId: 'a', day: 'Friday', stageId: 's', start: '20:00', end: '21:00' }] }), day('2026-10-01'))).toBeUndefined();
    expect(setTimesExpected(fest({ startDate: undefined }), day('2026-10-01'))).toBeUndefined();
    expect(setTimesExpected(fest(), day('2026-12-04'))).toBeUndefined();
  });
});
