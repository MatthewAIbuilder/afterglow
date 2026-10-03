import { describe, expect, it } from '@jest/globals';
import { questReminder } from '../questReminder';
import { REMINDER_PREFIX } from '../reminders';

describe('the 8 PM quest nudge', () => {
  it('is off unless you ask for it', () => {
    expect(questReminder(false, new Date(2026, 9, 3, 12), 2, 0)).toBeUndefined();
  });

  it('comes tonight while quests are left, saying how many and your streak', () => {
    const r = questReminder(true, new Date(2026, 9, 3, 12), 2, 4)!;
    expect(r.at).toEqual(new Date(2026, 9, 3, 20));
    expect(r.id.startsWith(REMINDER_PREFIX)).toBe(true);
    expect(r.body).toBe('2 quests left today. Keep your 4-day streak glowing.');
    expect(r.href).toBe('/quests');
  });

  it('moves to tomorrow once today is done, or after 8', () => {
    expect(questReminder(true, new Date(2026, 9, 3, 12), 0, 1)!.at).toEqual(new Date(2026, 9, 4, 20));
    const late = questReminder(true, new Date(2026, 9, 3, 21), 2, 0)!;
    expect(late.at).toEqual(new Date(2026, 9, 4, 20));
    expect(late.body).toBe('3 small quests left today, a little glow each.');
  });
});
