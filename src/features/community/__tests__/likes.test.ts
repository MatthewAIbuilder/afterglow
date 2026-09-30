import { describe, expect, it } from '@jest/globals';
import { likeChanges, OWNERS_MAX, sharedIdOf, wantedLikes, withOwner } from '../likes';

describe('public likes', () => {
  const owners = { 'community:a': 'maya', 'community:b': 'bo', 'community:mine': 'me' };

  it('wants every community clip you like, of someone else, whose owner is known', () => {
    const reactions = {
      'community:a': { liked: true },
      'community:b': { liked: false },
      'community:mine': { liked: true },
      'community:unknown': { liked: true },
      c1: { liked: true },
    };
    expect([...wantedLikes(reactions, { ...owners, c1: 'x' }, 'me')]).toEqual([['community:a', 'maya']]);
  });

  it('sends what isn’t sent and takes back what’s no longer liked', () => {
    const wanted = new Map([
      ['community:a', 'maya'],
      ['community:b', 'bo'],
    ]);
    expect(likeChanges(wanted, new Set(['community:b', 'community:gone']))).toEqual({ like: [['community:a', 'maya']], unlike: ['community:gone'] });
    expect(likeChanges(new Map(), new Set())).toEqual({ like: [], unlike: [] });
  });

  it('reads the shared memory from a clip id', () => {
    expect(sharedIdOf('community:abc')).toBe('abc');
    expect(sharedIdOf('c1')).toBeUndefined();
  });

  it('remembers owners, bounded, newest last', () => {
    let o: Record<string, string> = {};
    for (let i = 0; i < OWNERS_MAX + 2; i++) o = withOwner(o, `community:${i}`, 'u');
    expect(Object.keys(o)).toHaveLength(OWNERS_MAX);
    expect(o['community:0']).toBeUndefined();
    expect(withOwner(o, `community:${OWNERS_MAX + 1}`, 'u')).toBe(o);
  });
});
