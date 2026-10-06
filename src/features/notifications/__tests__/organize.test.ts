import { describe, expect, it } from '@jest/globals';
import type { Notice } from '../inbox';
import { ago, filterNotices, filtersWith, sortNotices } from '../organize';

const n = (id: string, kind: Notice['kind'], at?: number, title = id): Notice => ({ id, kind, title, body: '', href: '/', ...(at !== undefined ? { at } : {}) });
const DAY = 86_400_000;
const today = Date.UTC(2026, 9, 6);

describe('the bell, organised', () => {
  it('happening now first, then the newest first; no time counts as today', () => {
    const list = [n('bloom', 'sprout', today - 3 * DAY), n('soon', 'soon'), n('like', 'like', today + 5 * 3600_000), n('now', 'now'), n('lineup', 'lineup', today - DAY)];
    expect(sortNotices(list, today).map((x) => x.id)).toEqual(['now', 'like', 'soon', 'lineup', 'bloom']);
  });

  it('filters by kind and searches the words, offering only filters with something in them', () => {
    const list = [n('a', 'like', 1, '@sam liked your video of BOOGIE T'), n('b', 'sprout', 1, 'Your sprout bloomed'), n('c', 'lineup', 1, 'SIPPY added to EDC')];
    expect(filtersWith(list)).toEqual(['all', 'people', 'festivals', 'sprouts']);
    expect(filterNotices(list, 'people', '').map((x) => x.id)).toEqual(['a']);
    expect(filterNotices(list, 'all', 'boogie').map((x) => x.id)).toEqual(['a']);
    expect(filterNotices(list, 'sprouts', 'boogie')).toEqual([]);
  });

  it('says how long ago, briefly', () => {
    const now = today;
    expect(ago(now - 20_000, now)).toBe('now');
    expect(ago(now - 5 * 60_000, now)).toBe('5m');
    expect(ago(now - 3 * 3600_000, now)).toBe('3h');
    expect(ago(now - 2 * DAY, now)).toBe('2d');
    expect(ago(now - 20 * DAY, now)).toMatch(/^Sep \d+$/);
    expect(ago(undefined, now)).toBeUndefined();
  });
});
