import { describe, expect, it } from '@jest/globals';
import { GUEST, moveTo, OWNER_KEY, putAwayKey, type ScopeStorage } from '../scope';

function memory(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  const s: ScopeStorage = {
    multiGet: async (keys) => keys.map((k) => [k, m.get(k) ?? null] as const),
    multiSet: async (pairs) => pairs.forEach(([k, v]) => m.set(k, v)),
    multiRemove: async (keys) => keys.forEach((k) => m.delete(k)),
  };
  return { m, s };
}

describe('each account’s things on a shared phone', () => {
  it('the first time, what’s on the phone belongs to whoever is signed in: nothing moves', async () => {
    const { m, s } = memory({ 'reactions.v1': 'mine' });
    expect(await moveTo(s, 'maya')).toBe('claimed');
    expect(m.get('reactions.v1')).toBe('mine');
    expect(m.get(OWNER_KEY)).toBe('maya');
    expect(await moveTo(s, 'maya')).toBe('same');
  });

  it('switching puts one account’s things away and brings the other’s back; an account new to the phone starts empty', async () => {
    const { m, s } = memory({ [OWNER_KEY]: 'maya', 'reactions.v1': 'maya likes', 'going.v1': 'maya going', 'hints.v1': 'phone' });
    expect(await moveTo(s, 'review')).toBe('switched');
    expect(m.get('reactions.v1')).toBeUndefined();
    expect(m.get('going.v1')).toBeUndefined();
    expect(m.get('hints.v1')).toBe('phone');
    expect(m.get(putAwayKey('reactions.v1', 'maya'))).toBe('maya likes');

    m.set('reactions.v1', 'review likes');
    expect(await moveTo(s, 'maya')).toBe('switched');
    expect(m.get('reactions.v1')).toBe('maya likes');
    expect(m.get('going.v1')).toBe('maya going');
    expect(m.get(putAwayKey('reactions.v1', 'review'))).toBe('review likes');
    expect(m.get(OWNER_KEY)).toBe('maya');
  });

  it('signing up from signed out keeps what you did signed out; signing out starts fresh; signing in again brings yours back', async () => {
    const { m, s } = memory({ [OWNER_KEY]: GUEST, 'reactions.v1': 'before signing up' });
    expect(await moveTo(s, 'new')).toBe('carried');
    expect(m.get('reactions.v1')).toBe('before signing up');
    expect(await moveTo(s, GUEST)).toBe('switched');
    expect(m.get('reactions.v1')).toBeUndefined();
    // An account that's been on this phone before isn't handed what's signed out.
    m.set('reactions.v1', 'signed out');
    expect(await moveTo(s, 'new')).toBe('switched');
    expect(m.get('reactions.v1')).toBe('before signing up');
  });
});
