import { describe, expect, it } from '@jest/globals';
import { accountDetail, accountTitle, cleanSaved, SAVED_MAX, withAccount, withoutAccount } from '../saved';

const a = (uid: string, over = {}) => ({ uid, email: `${uid}@x.com`, savedAt: '2026-10-03T10:00:00.000Z', ...over });

describe('accounts saved for switching', () => {
  it('adds, refreshes in place and removes', () => {
    const one = withAccount([], a('maya'));
    const two = withAccount(one, a('hq'));
    expect(two.map((x) => x.uid)).toEqual(['maya', 'hq']);
    const named = withAccount(two, a('maya', { name: 'Maya', handle: 'maya', savedAt: '2026-10-04T00:00:00.000Z' }));
    expect(named[0]).toMatchObject({ uid: 'maya', name: 'Maya', savedAt: '2026-10-03T10:00:00.000Z' });
    expect(withAccount(named, a('maya', { name: 'Maya', handle: 'maya' }))).toBe(named);
    expect(withAccount(named, a('maya'))[0].name).toBe('Maya');
    expect(withoutAccount(named, 'maya').map((x) => x.uid)).toEqual(['hq']);
    let many = named;
    for (let i = 0; i < 10; i++) many = withAccount(many, a(`u${i}`));
    expect(many).toHaveLength(SAVED_MAX);
  });

  it('reads back safely, with no passwords', () => {
    expect(cleanSaved([a('maya', { password: 'secret', avatarUrl: 'http://x' }), a('maya'), { uid: 'x' }, 'junk'])).toEqual([a('maya')]);
    expect(cleanSaved('nope')).toEqual([]);
  });

  it('names each account', () => {
    expect(accountTitle(a('maya', { name: 'Maya', handle: 'maya' }))).toBe('Maya');
    expect(accountDetail(a('maya', { name: 'Maya', handle: 'maya' }))).toBe('@maya · maya@x.com');
    expect(accountTitle(a('hq'))).toBe('hq@x.com');
    expect(accountDetail(a('hq'))).toBe('');
  });
});
