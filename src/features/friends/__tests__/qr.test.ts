import { describe, expect, it } from '@jest/globals';
import { ADD_KEEP_MS, ADD_REFUSED_MAX, addDelay, cleanAdds, dueAdds, markAdded, markTried, nextDue, queueAdd, tidyAdds } from '../adds';
import { cardFrom, codeFrom, CODE_LENGTH, friendLink, isFinder, readFriendLink } from '../qr';
import { qrMatrix } from '../qrMatrix';

const card = { uid: 'uidMaya', handle: 'maya', name: 'Maya Lopez', code: 'abcd2345wxyz' };

describe('friend codes', () => {
  it('writes a link and reads it back', () => {
    const link = friendLink(card);
    expect(link).toBe('https://afterglowmusic.app/add/maya?u=uidMaya&c=abcd2345wxyz&n=Maya%20Lopez');
    expect(readFriendLink(link)).toEqual(card);
    expect(readFriendLink(link.replace('afterglowmusic.app', 'afterglowmusic.web.app'))).toEqual(card);
    expect(readFriendLink('afterglow://add/maya?u=uidMaya&c=abcd2345wxyz')).toEqual({ ...card, name: 'maya' });
  });

  it('ignores anything that isn’t an Afterglow friend code', () => {
    expect(readFriendLink('https://example.com/add/maya?u=uidMaya&c=abcd2345wxyz')).toBeUndefined();
    expect(readFriendLink('https://afterglowmusic.app/u/maya')).toBeUndefined();
    expect(readFriendLink('https://afterglowmusic.app/add/maya?u=uidMaya')).toBeUndefined();
    expect(readFriendLink('https://afterglowmusic.app/add/Bad Handle!?u=uidMaya&c=abcd2345wxyz')).toBeUndefined();
    expect(readFriendLink('TICKET-12345')).toBeUndefined();
    expect(cardFrom({ handle: 'maya', u: 'uidMaya', c: 'SHORT' })).toBeUndefined();
  });

  it('cuts long names short and makes codes from random bytes', () => {
    expect(cardFrom({ handle: '@Maya', u: 'x', c: 'abcd2345wxyz', n: 'A'.repeat(60) })?.name).toHaveLength(24);
    const code = codeFrom(Array.from({ length: CODE_LENGTH }, (_, i) => i * 37));
    expect(code).toMatch(/^[a-z0-9]{12}$/);
  });

  it('encodes a scannable square with the corner squares where scanners look', () => {
    const grid = qrMatrix(friendLink(card));
    expect(grid.size).toBeGreaterThanOrEqual(21);
    // The top-left finder: a dark ring around a light gap around a dark centre.
    expect(grid.dark(0, 0)).toBe(true);
    expect(grid.dark(1, 1)).toBe(false);
    expect(grid.dark(3, 3)).toBe(true);
    expect(isFinder(grid.size, 0, 0)).toBe(true);
    expect(isFinder(grid.size, grid.size - 1, grid.size - 1)).toBe(false);
  });
});

describe('friend adds with bad signal', () => {
  const now = 1_000_000;

  it('keeps a scan, tries again with a growing wait, and says when it went through later', () => {
    let list = queueAdd([], card, 'me', now);
    expect(dueAdds(list, 'me', now)).toHaveLength(1);
    list = markTried(list, 'me', 'uidMaya', false, now);
    expect(dueAdds(list, 'me', now + 1000)).toHaveLength(0);
    expect(nextDue(list, 'me')).toBe(now + addDelay(1));
    expect(dueAdds(list, 'me', now + addDelay(1))).toHaveLength(1);
    list = markAdded(list, 'me', 'uidMaya', now + 20_000);
    expect(list[0]).toMatchObject({ state: 'added', later: true });
    // Scanning someone already added changes nothing.
    expect(queueAdd(list, card, 'me', now + 30_000)).toBe(list);
    // Another account on the same phone keeps its own list.
    expect(dueAdds(queueAdd(list, card, 'other', now), 'me', now + 10 ** 7)).toHaveLength(0);
  });

  it('a first try that works isn’t news', () => {
    const list = markAdded(queueAdd([], card, 'me', now), 'me', 'uidMaya', now);
    expect(list[0].later).toBe(false);
  });

  it('gives up after many refusals or a day of waiting, and forgets old ones', () => {
    let list = queueAdd([], card, 'me', now);
    for (let i = 0; i < ADD_REFUSED_MAX; i++) list = markTried(list, 'me', 'uidMaya', true, now + i);
    expect(list[0].state).toBe('failed');
    const waiting = queueAdd([], card, 'me', now);
    expect(tidyAdds(waiting, now + ADD_KEEP_MS + 1)[0].state).toBe('failed');
    expect(tidyAdds(list, now + 4 * 24 * 3600_000)).toHaveLength(0);
    expect(tidyAdds(waiting, now)).toBe(waiting);
    // No-signal tries never count as refusals.
    let calm = queueAdd([], card, 'me', now);
    for (let i = 0; i < 30; i++) calm = markTried(calm, 'me', 'uidMaya', false, now + i);
    expect(calm[0].state).toBe('waiting');
  });

  it('reads what was saved back safely', () => {
    const list = queueAdd([], card, 'me', now);
    expect(cleanAdds(JSON.parse(JSON.stringify(list)), now)).toEqual(list);
    expect(cleanAdds([{ uid: 1 }, null, 'x'], now)).toEqual([]);
    expect(cleanAdds('nope', now)).toEqual([]);
  });
});
