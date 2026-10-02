import { describe, expect, it } from '@jest/globals';
import type { Activity } from '../../social/models';
import { activityNotices } from '../activity';

const handles: Record<string, string> = { u1: 'sam', u2: 'bo', u3: 'cara', u4: 'dee' };
const look = (blocked: string[] = []) => ({
  handleOf: (u: string) => handles[u],
  videoOf: (id: string) => (id === 'm1' ? 'your video of HEDEX' : undefined),
  blocked: new Set(blocked),
});

describe('activity in the bell', () => {
  it('new followers and likes, newest first, likes on one video together', () => {
    const items: Activity[] = [
      { kind: 'like', id: 'm1_u3', from: 'u3', memoryId: 'm1', createdAt: '2026-09-30T12:00' },
      { kind: 'follow', id: 'u2_me', from: 'u2', createdAt: '2026-09-30T11:00' },
      { kind: 'like', id: 'm1_u1', from: 'u1', memoryId: 'm1', createdAt: '2026-09-30T10:00' },
      { kind: 'like', id: 'm1_u4', from: 'u4', memoryId: 'm1', createdAt: '2026-09-30T09:00' },
      { kind: 'like', id: 'm2_u1', from: 'u1', memoryId: 'm2', createdAt: '2026-09-30T08:00' },
    ];
    const got = activityNotices(items, look());
    expect(got.map((n) => n.title)).toEqual(['@cara and 2 others liked your video of HEDEX', '@bo started following you', '@sam liked your video']);
    expect(got[0]).toMatchObject({ id: 'like:m1:m1_u3', kind: 'like', href: '/shared/m1' });
    expect(got[1]).toMatchObject({ id: 'follow:u2_me', href: '/u/bo' });
  });

  it('comments say who and what, each its own notice, opening the comments', () => {
    const items: Activity[] = [
      { kind: 'comment', id: 'c1', from: 'u1', memoryId: 'm1', text: 'That drop!', createdAt: '2026-09-30T12:00' },
      { kind: 'comment', id: 'c2', from: 'u2', memoryId: 'm2', text: 'x'.repeat(120), createdAt: '2026-09-30T11:00' },
    ];
    const got = activityNotices(items, look());
    expect(got[0]).toMatchObject({ id: 'comment:c1', kind: 'comment', title: '@sam commented on your video of HEDEX', body: '“That drop!”', href: '/comments/m1' });
    expect(got[1].title).toBe('@bo commented on your video');
    expect(got[1].body.length).toBeLessThan(90);
  });

  it('two likers are both named', () => {
    const items: Activity[] = [
      { kind: 'like', id: 'm1_u1', from: 'u1', memoryId: 'm1', createdAt: '2' },
      { kind: 'like', id: 'm1_u2', from: 'u2', memoryId: 'm1', createdAt: '1' },
    ];
    expect(activityNotices(items, look())[0].title).toBe('@sam and @bo liked your video of HEDEX');
  });

  it('leaves out people you blocked and deleted accounts', () => {
    const items: Activity[] = [
      { kind: 'follow', id: 'u1_me', from: 'u1', createdAt: '2' },
      { kind: 'follow', id: 'gone_me', from: 'gone', createdAt: '1' },
    ];
    expect(activityNotices(items, look(['u1']))).toEqual([]);
  });
});
