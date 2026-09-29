import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { festivalReminders, REMINDER_HOUR, reminderChanges } from '../reminders';

const fest = (id: string, startDate?: string, sets = false): Festival => ({
  id,
  name: id.toUpperCase(),
  dates: '',
  location: '',
  lineup: ['x'],
  days: ['fri'],
  stages: [{ id: 'main', name: 'Main' }],
  ...(startDate ? { startDate, endDate: startDate } : {}),
  ...(sets ? { sets: [{ artistId: 'x', day: 'fri', stageId: 'main', start: '22:00', end: '23:00' }] } : {}),
});
const now = new Date(2026, 8, 29, 12);

describe('festival reminders', () => {
  it('reminds a week before and the day before, mid-morning local time, for festivals you are going to', () => {
    const list = festivalReminders([fest('a', '2026-11-06'), fest('b', '2026-12-01')], ['a'], now);
    expect(list.map((r) => r.title)).toEqual(['A is a week away', 'A is tomorrow']);
    expect(list[0].at).toEqual(new Date(2026, 9, 30, REMINDER_HOUR));
    expect(list[1].at).toEqual(new Date(2026, 10, 5, REMINDER_HOUR));
    expect(list.every((r) => r.festivalId === 'a')).toBe(true);
  });

  it('skips reminders already past, and festivals without dates', () => {
    const list = festivalReminders([fest('soon', '2026-10-02'), fest('undated')], ['soon', 'undated'], now);
    expect(list.map((r) => r.title)).toEqual(['SOON is tomorrow']);
  });

  it('crosses months and years', () => {
    const list = festivalReminders([fest('nye', '2027-01-01')], ['nye'], now);
    expect(list[0].at).toEqual(new Date(2026, 11, 25, REMINDER_HOUR));
    expect(list[1].at).toEqual(new Date(2026, 11, 31, REMINDER_HOUR));
  });

  it('reminds the day before each weekend of a festival run over two', () => {
    const acl: Festival = {
      ...fest('acl', '2026-10-02'),
      endDate: '2026-10-11',
      weekends: [
        { start: '2026-10-02', end: '2026-10-04' },
        { start: '2026-10-09', end: '2026-10-11' },
      ],
    };
    expect(festivalReminders([acl], ['acl'], now).map((r) => r.title)).toEqual(['ACL is tomorrow', 'ACL weekend 2 is tomorrow']);
    expect(festivalReminders([acl], ['acl'], new Date(2026, 9, 5, 12)).map((r) => r.title)).toEqual(['ACL weekend 2 is tomorrow']);
  });

  it('changes its wording, and so its id, once set times are out', () => {
    const before = festivalReminders([fest('a', '2026-11-06')], ['a'], now);
    const after = festivalReminders([fest('a', '2026-11-06', true)], ['a'], now);
    expect(after[1].body).toMatch(/day by day/);
    expect(after[1].id).not.toBe(before[1].id);
  });

  it('works out what to cancel and schedule, leaving anything not ours alone', () => {
    const wanted = festivalReminders([fest('a', '2026-11-06')], ['a'], now);
    const stale = 'afterglow-remind:gone:2026-10-10:eve:lineup';
    const { cancel, schedule } = reminderChanges(wanted, [wanted[0].id, stale, 'someone-else']);
    expect(cancel).toEqual([stale]);
    expect(schedule.map((r) => r.id)).toEqual([wanted[1].id]);
  });
});
