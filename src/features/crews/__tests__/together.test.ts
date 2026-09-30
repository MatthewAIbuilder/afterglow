import { describe, expect, it } from '@jest/globals';
import type { Crew } from '../../social/models';
import { crewMembersLine, crewStars, crewTogether, firstName, picksChanged, sharedCountLine, starsLine, starsShort, whoLine } from '../together';

const lineup = ['a', 'b', 'c', 'd'];
const pick = (uid: string, artists: string[]) => ({ uid, artists, updatedAt: '' });
const names: Record<string, string> = { me: 'Me', maya: 'Maya', sam: 'Sam', jo: 'Jo', al: 'Al' };
const nameOf = (u: string) => names[u];

describe('crew picks together', () => {
  it('sets more than one of you starred, most of you first, then billing order', () => {
    const t = crewTogether([pick('me', ['d', 'b', 'a']), pick('maya', ['b', 'd']), pick('sam', ['d', 'c'])], ['me', 'maya', 'sam'], lineup);
    expect(t.shared).toEqual([
      { artistId: 'd', who: ['me', 'maya', 'sam'] },
      { artistId: 'b', who: ['me', 'maya'] },
    ]);
    expect(t.byMember.me).toEqual(['a', 'b', 'd']);
  });

  it('ignores people who left, artists off the lineup, repeats and empty lists', () => {
    const t = crewTogether([pick('me', ['a', 'a', 'zz']), pick('gone', ['a']), pick('maya', [])], ['me', 'maya'], lineup);
    expect(t.shared).toEqual([]);
    expect(t.byMember).toEqual({ me: ['a'] });
    expect(sharedCountLine(t)).toBeUndefined();
    expect(sharedCountLine(crewTogether([pick('me', ['a']), pick('maya', ['a'])], ['me', 'maya'], lineup))).toBe('1 set you share');
  });

  it('says who in plain words', () => {
    expect(whoLine(['me', 'maya'], 2, 'me', nameOf)).toBe('Both of you');
    expect(whoLine(['me', 'maya', 'sam'], 3, 'me', nameOf)).toBe('All 3 of you');
    expect(whoLine(['maya', 'me'], 3, 'me', nameOf)).toBe('Maya and you');
    expect(whoLine(['maya', 'sam', 'me'], 4, 'me', nameOf)).toBe('Maya, Sam and you');
    expect(whoLine(['maya', 'sam'], 3, 'me', nameOf)).toBe('Maya and Sam');
  });

  it('describes the crew', () => {
    const crew = (members: string[]): Crew => ({ id: 'c', festivalId: 'f', name: 'Crew', owner: 'me', members, createdAt: '' });
    expect(crewMembersLine(crew(['me']), 'me', nameOf)).toBe('Just you so far. Invite your friends.');
    expect(crewMembersLine(crew(['me', 'maya', 'sam']), 'me', nameOf)).toBe('You, Maya and Sam');
    expect(crewMembersLine(crew(['me', 'maya', 'sam', 'jo', 'al']), 'me', nameOf)).toBe('You, Maya, Sam, Jo and 1 more');
    expect(firstName('Maya Chen')).toBe('Maya');
  });

  it('knows when picks changed, whatever the order', () => {
    expect(picksChanged(['a'], undefined)).toBe(true);
    expect(picksChanged(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(picksChanged(['a'], ['a', 'b'])).toBe(true);
    expect(picksChanged([], [])).toBe(false);
  });
});


describe('crewmates’ stars across the app', () => {
  const crew = (id: string, festivalId: string, members: string[]) => ({ id, festivalId, name: id, owner: members[0], members, createdAt: '' });
  const names: Record<string, string> = { me: 'Me', maya: 'Maya', sam: 'Sam', jo: 'Jo' };
  it('per festival and artist: never you, blocked people or people who left; each name once', () => {
    const stars = crewStars(
      [
        { crew: crew('c1', 'f', ['me', 'maya', 'sam']), picks: [pick('me', ['a']), pick('maya', ['a', 'b']), pick('sam', ['a']), pick('gone', ['a'])] },
        { crew: crew('c2', 'f', ['me', 'maya', 'jo']), picks: [pick('maya', ['a']), pick('jo', ['b'])] },
        { crew: crew('c3', 'g', ['me', 'sam']), picks: [pick('sam', ['z'])] },
      ],
      { me: 'me', blocked: new Set(['jo']), nameOf: (u) => names[u] },
    );
    expect(stars).toEqual({ f: { a: ['Maya', 'Sam'], b: ['Maya'] }, g: { z: ['Sam'] } });
  });

  it('says it briefly on a row, fully on a page', () => {
    expect(starsShort([])).toBeUndefined();
    expect(starsShort(['Maya'])).toBe('★ Maya');
    expect(starsShort(['Maya', 'Sam'])).toBe('★ Maya and Sam');
    expect(starsShort(['Maya', 'Sam', 'Jo', 'Al'])).toBe('★ Maya, Sam +2');
    expect(starsLine(['Maya'])).toBe('Maya starred this in your crew');
    expect(starsLine(['Maya', 'Sam', 'Jo'])).toBe('Maya, Sam and 1 other starred this in your crew');
  });
});
