import { describe, expect, it } from '@jest/globals';
import { cleanShareOutbox, queueShare, SHARE_OUTBOX_MAX, sharesOf, shareRetryDelay, shareTried, unqueueShare } from '../shareOutbox';

describe('the share to Discover outbox', () => {
  it('keeps each video once per account, oldest first', () => {
    let o = queueShare([], { memoryId: 'b', uid: 'sam', at: 20 });
    o = queueShare(o, { memoryId: 'a', uid: 'sam', at: 10 });
    o = queueShare(o, { memoryId: 'a', uid: 'sam', at: 30 });
    o = queueShare(o, { memoryId: 'a', uid: 'ana', at: 40 });
    expect(o.map((i) => `${i.uid}:${i.memoryId}`)).toEqual(['sam:a', 'sam:b', 'ana:a']);
    expect(sharesOf(o, 'sam').map((i) => i.memoryId)).toEqual(['a', 'b']);
    expect(sharesOf(o, undefined)).toEqual([]);
  });

  it('counts tries with no signal, and lets one go for one account only', () => {
    let o = queueShare(queueShare([], { memoryId: 'a', uid: 'sam', at: 1 }), { memoryId: 'a', uid: 'ana', at: 2 });
    o = shareTried(o, 'a', 'sam');
    expect(o.find((i) => i.uid === 'sam')!.tries).toBe(1);
    o = unqueueShare(o, 'a', 'sam');
    expect(o).toEqual([{ memoryId: 'a', uid: 'ana', at: 2, tries: 0 }]);
    expect(unqueueShare(o, 'zzz')).toBe(o);
  });

  it('waits a little longer each time, at most two minutes', () => {
    expect(shareRetryDelay(0)).toBe(15_000);
    expect(shareRetryDelay(1)).toBe(30_000);
    expect(shareRetryDelay(10)).toBe(120_000);
  });

  it('reads a saved outbox back, dropping anything unreadable', () => {
    expect(cleanShareOutbox('nope')).toEqual([]);
    expect(
      cleanShareOutbox([
        { memoryId: 'b', uid: 'sam', at: 5, tries: 2 },
        { memoryId: 'a', uid: 'sam', at: 1 },
        { memoryId: 'a', uid: 'sam', at: 9 },
        { memoryId: '', uid: 'sam', at: 1 },
        { memoryId: 'c', at: 1 },
        null,
      ]),
    ).toEqual([
      { memoryId: 'a', uid: 'sam', at: 1, tries: 0 },
      { memoryId: 'b', uid: 'sam', at: 5, tries: 2 },
    ]);
    const many = Array.from({ length: SHARE_OUTBOX_MAX + 5 }, (_, i) => ({ memoryId: `m${i}`, uid: 'sam', at: i }));
    expect(cleanShareOutbox(many)).toHaveLength(SHARE_OUTBOX_MAX);
  });
});
