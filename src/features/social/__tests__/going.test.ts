import { describe, expect, it } from '@jest/globals';
import { goersLine, splitGoers } from '../going';
import type { Profile } from '../models';

const p = (uid: string, displayName: string): Profile => ({
  uid,
  handle: displayName.toLowerCase(),
  displayName,
  bio: '',
  festivals: ['f'],
  sounds: [],
  showFestivals: true,
  showSound: false,
  artists: [],
  showArtists: true,
  createdAt: '',
  updatedAt: '',
});
const NONE = new Set<string>();

describe('who else is going', () => {
  it('people you follow first, then everyone else; never you or anyone you blocked; A to Z', () => {
    const list = [p('3', 'Zed'), p('1', 'Maya'), p('me', 'Me'), p('2', 'Bo'), p('4', 'Blocked'), p('1', 'Maya')];
    const g = splitGoers(list, { following: new Set(['1', '3']), blocked: new Set(['4']), me: 'me' });
    expect(g.friends.map((x) => x.displayName)).toEqual(['Maya', 'Zed']);
    expect(g.others.map((x) => x.displayName)).toEqual(['Bo']);
  });

  it('says it plainly', () => {
    const one = [p('1', 'Maya')];
    const two = [p('1', 'Maya'), p('2', 'Sam')];
    const four = [...two, p('3', 'Bo'), p('4', 'Cy')];
    expect(goersLine({ friends: one, others: [] })).toBe('Maya is going');
    expect(goersLine({ friends: two, others: [] })).toBe('Maya and Sam are going');
    expect(goersLine({ friends: four, others: one })).toBe('Maya and 3 others you follow are going, plus 1 other on Afterglow');
    expect(goersLine({ friends: [], others: two })).toBe('2 people on Afterglow are going');
    expect(goersLine({ friends: [], others: one })).toBe('1 person on Afterglow is going');
    expect(goersLine({ friends: [], others: [] })).toBeUndefined();
    expect(splitGoers([], { following: NONE, blocked: NONE })).toEqual({ friends: [], others: [] });
  });
});
