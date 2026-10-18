import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { prepReminders } from '../reminders';

const f = (over: Partial<Festival> = {}) =>
  ({ id: 'edc', name: 'EDC', dates: 'Nov 6 to 8', location: 'Orlando', lineup: [], days: [], stages: [], startDate: '2026-11-06', endDate: '2026-11-08', ...over }) as Festival;

describe('checklist reminders', () => {
  const now = new Date(2026, 10, 1, 12, 0);
  const progress = (done: number, total = 11) => () => ({ done, total });

  it('the evening before at 6 PM and the morning it starts at 8, opening the checklist', () => {
    const r = prepReminders([f()], ['edc'], progress(3), now);
    expect(r.map((x) => [x.at.getDate(), x.at.getHours()])).toEqual([[5, 18], [6, 8]]);
    expect(r.map((x) => x.title)).toEqual(['Packed for EDC?', 'EDC starts today']);
    expect(r[0].body).toBe('8 things left on your checklist. Tap to finish it.');
    expect(r.every((x) => x.href === '/prep/edc')).toBe(true);
  });

  it('says so when it’s all done, one thing left in the singular, and moves on when you tick (the id carries what’s left)', () => {
    expect(prepReminders([f()], ['edc'], progress(11), now)[0].body).toBe('Your checklist is all done. Have a great one.');
    expect(prepReminders([f()], ['edc'], progress(10), now)[0].body).toBe('1 thing left on your checklist. Tap to finish it.');
    expect(prepReminders([f()], ['edc'], progress(3), now)[0].id).not.toBe(prepReminders([f()], ['edc'], progress(4), now)[0].id);
  });

  it('only for festivals you’re going to, and only what’s still ahead', () => {
    expect(prepReminders([f()], [], progress(0), now)).toEqual([]);
    expect(prepReminders([f()], ['edc'], progress(0), new Date(2026, 10, 5, 19, 0)).map((x) => x.title)).toEqual(['EDC starts today']);
    expect(prepReminders([f()], ['edc'], progress(0), new Date(2026, 10, 6, 9, 0))).toEqual([]);
  });

  it('each weekend of a two-weekend festival gets its own', () => {
    const two = f({ weekends: [{ start: '2026-11-06', end: '2026-11-08' }, { start: '2026-11-13', end: '2026-11-15' }] } as never);
    const r = prepReminders([two], ['edc'], progress(0), now);
    expect(r).toHaveLength(4);
    expect(r[2].title).toBe('Packed for EDC weekend 2?');
    expect(r[3].title).toBe('EDC weekend 2 starts today');
  });
});
