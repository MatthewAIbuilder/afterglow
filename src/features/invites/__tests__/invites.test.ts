import { describe, expect, it } from '@jest/globals';
import { cleanPendingInvite, countByInviter, INVITE_WINDOW_MS, inviteProgress, newInvitees, plusEarners } from '../invites';

const card = { uid: 'maya-uid', handle: 'maya', code: 'abcdefgh2345', name: 'Maya' };

describe('invite rewards', () => {
  it('counts towards the next reward: the pin at 1, Plus at 10, Legend at 25', () => {
    expect(inviteProgress(0)).toMatchObject({ earned: [], next: { key: 'plus-one' }, toGo: 1, share: 0 });
    expect(inviteProgress(1)).toMatchObject({ earned: [{ key: 'plus-one' }], next: { key: 'bring-the-crew' }, toGo: 9 });
    expect(inviteProgress(4).share).toBeCloseTo(3 / 9);
    expect(inviteProgress(10)).toMatchObject({ next: { key: 'legend' }, toGo: 15 });
    expect(inviteProgress(30)).toMatchObject({ toGo: 0, share: 1 });
    expect(inviteProgress(30).next).toBeUndefined();
    expect(inviteProgress(30).earned.map((x) => x.key)).toEqual(['plus-one', 'bring-the-crew', 'legend']);
  });

  it('keeps an opened invite link for a week, and only a whole one', () => {
    const now = 1_800_000_000_000;
    expect(cleanPendingInvite({ card, at: now - 1000 }, now)).toEqual({ card, at: now - 1000 });
    expect(cleanPendingInvite({ card, at: now - INVITE_WINDOW_MS - 1 }, now)).toBeUndefined();
    expect(cleanPendingInvite({ card: { ...card, code: 'x' }, at: now }, now)).toBeUndefined();
    expect(cleanPendingInvite({ card: { ...card, uid: 'bad uid!' }, at: now }, now)).toBeUndefined();
    expect(cleanPendingInvite('nope', now)).toBeUndefined();
  });

  it('says who joined since you last looked, newest first', () => {
    const list = [
      { uid: 'a', at: '2026-10-28T10:00:00.000Z' },
      { uid: 'b', at: '2026-10-29T10:00:00.000Z' },
      { uid: 'c', at: '2026-10-27T10:00:00.000Z' },
    ];
    expect(newInvitees(list, new Set(['c'])).map((i) => i.uid)).toEqual(['b', 'a']);
  });

  it('lets HQ see who has earned a month of Plus', () => {
    const invites = [...Array(12).fill({ by: 'maya' }), ...Array(10).fill({ by: 'sam' }), ...Array(3).fill({ by: 'lee' })];
    const counts = countByInviter(invites);
    expect(counts).toEqual([
      { by: 'maya', count: 12 },
      { by: 'sam', count: 10 },
      { by: 'lee', count: 3 },
    ]);
    expect(plusEarners(counts).map((c) => c.by)).toEqual(['maya', 'sam']);
  });
});
