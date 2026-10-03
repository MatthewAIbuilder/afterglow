import { describe, expect, it } from '@jest/globals';
import { agoShort, byDay, daysAgo, isSupportAccount, unseenReplies, weekLine, weeks } from '../admin';
import type { SupportMessage } from '../../social/models';

const NOW = new Date(2026, 9, 3, 15, 0);
const at = (daysBack: number, h = 12) => new Date(2026, 9, 3 - daysBack, h).toISOString();

describe('the support dashboard', () => {
  it('opens only for the support email', () => {
    expect(isSupportAccount({ uid: 'a', email: 'AfterglowMusic.Support@gmail.com ' })).toBe(true);
    expect(isSupportAccount({ uid: 'a', email: 'someone@gmail.com' })).toBe(false);
    expect(isSupportAccount(null)).toBe(false);
  });

  it('counts day by day, today last', () => {
    const days = byDay([at(0), at(0, 9), at(1), at(13), at(20), 'junk'], 14, NOW);
    expect(days).toHaveLength(14);
    expect(days[13]).toMatchObject({ label: 'Oct 3', n: 2 });
    expect(days[12].n).toBe(1);
    expect(days[0]).toMatchObject({ label: 'Sep 20', n: 1 });
    expect(weeks(days)).toEqual({ thisWeek: 3, lastWeek: 1 });
    expect(daysAgo(NOW, 7)).toBe(new Date(2026, 8, 26).toISOString());
  });

  it('says it in plain words', () => {
    const noun = { one: 'new person', many: 'new people' };
    expect(weekLine(noun, { thisWeek: 12, lastWeek: 9 })).toBe('12 new people this week, 3 more than the week before.');
    expect(weekLine(noun, { thisWeek: 1, lastWeek: 4 })).toBe('1 new person this week, 3 fewer than the week before.');
    expect(weekLine(noun, { thisWeek: 2, lastWeek: 2 })).toBe('2 new people this week, the same as the week before.');
    expect(weekLine(noun, { thisWeek: 0, lastWeek: 0 })).toBe('No new people yet this week.');
    expect(agoShort(new Date(NOW.getTime() - 90 * 60_000).toISOString(), NOW.getTime())).toBe('2 h ago');
  });

  it('knows which replies are new', () => {
    const m = (id: string, repliedAt?: string): SupportMessage => ({ id, uid: 'u', topic: 'help', text: 'x', status: repliedAt ? 'answered' : 'open', createdAt: at(2), ...(repliedAt ? { reply: 'Hi', repliedAt } : {}) });
    expect(unseenReplies([m('a', at(0)), m('b', at(3)), m('c')], Date.parse(at(1)))).toBe(1);
  });
});
