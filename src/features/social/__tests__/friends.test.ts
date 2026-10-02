import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { crewPeopleLine, followBack, goerSuggestions, inviteText } from '../friends';
import type { Profile } from '../models';
import { cleanComment, commentProblem } from '../validate';

const p = (uid: string, name: string): Profile => ({
  uid,
  handle: uid,
  displayName: name,
  bio: '',
  festivals: [],
  sounds: [],
  showFestivals: true,
  showSound: false,
  createdAt: '',
  updatedAt: '',
});
const f = (id: string): Festival => ({ id, name: id.toUpperCase(), dates: '', location: '', lineup: [], days: [], stages: [] });
const known = { following: new Set(['sam']), blocked: new Set(['troll']), me: 'me' };

describe('the friends hub', () => {
  it('suggests following back, never people you follow, block or yourself', () => {
    expect(followBack(['maya', 'sam', 'troll', 'me', 'maya', 'jo'], known)).toEqual(['maya', 'jo']);
    expect(followBack(['a', 'b', 'c'], known, 2)).toEqual(['a', 'b']);
  });

  it('suggests people going to your festivals, soonest first, each once', () => {
    const out = goerSuggestions(
      [
        { festival: f('cc4'), profiles: [p('zed', 'Zed'), p('amy', 'Amy'), p('sam', 'Sam'), p('me', 'Me')] },
        { festival: f('nye'), profiles: [p('amy', 'Amy'), p('bo', 'Bo'), p('troll', 'Troll')] },
      ],
      known,
    );
    expect(out.map((s) => [s.profile.uid, s.festival.id])).toEqual([
      ['amy', 'cc4'],
      ['zed', 'cc4'],
      ['bo', 'nye'],
    ]);
  });

  it('writes the invite with your handle and the festival', () => {
    expect(inviteText('maya', f('cc4'))).toBe("Join me on Afterglow, I'm @maya. Let's plan CC4 together.\nhttps://afterglowmusic.app/u/maya");
    expect(inviteText()).toMatch(/^Join me on Afterglow\. Find your sets/);
    expect([crewPeopleLine(1), crewPeopleLine(4)]).toEqual(['Just you so far', '4 of you']);
  });
});

describe('comments', () => {
  it('are tidied, and refused when empty, too long or unkind', () => {
    expect(cleanComment('  hi\n\n\n\nthere  ')).toBe('hi\n\nthere');
    expect(commentProblem('   ')).toBe('Write something first.');
    expect(commentProblem('x'.repeat(301))).toMatch(/under 300/);
    expect(commentProblem('what a set')).toBeUndefined();
    expect(commentProblem('you are a fucking idiot')).toMatch(/Keep it kind/);
  });
});
