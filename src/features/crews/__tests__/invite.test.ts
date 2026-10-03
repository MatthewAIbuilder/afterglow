import { describe, expect, it } from '@jest/globals';
import type { CrewInvite, Profile } from '../../social/models';
import { inviteCandidates, inviteTitle, openInvites } from '../invite';

const p = (uid: string, displayName: string, festivals: string[] = []): Profile => ({
  uid,
  handle: displayName.toLowerCase(),
  displayName,
  bio: '',
  festivals,
  sounds: [],
  showFestivals: true,
  showSound: false,
  createdAt: '',
  updatedAt: '',
});

describe('inviting people you know to a crew', () => {
  const people = [p('z', 'Zed'), p('m', 'Maya', ['cc4']), p('a', 'Ava'), p('me', 'Me'), p('b', 'Bo'), p('s', 'Sam'), p('a', 'Ava again')];
  const opts = { me: 'me', members: ['me', 's'], invited: new Set(['z']), blocked: new Set(['b']), festivalId: 'cc4' };

  it('puts people going to the festival first, then A to Z, crewmates last; never you, blocked people or twice', () => {
    const rows = inviteCandidates(people, opts);
    expect(rows.map((r) => [r.profile.displayName, r.status, r.going])).toEqual([
      ['Maya', 'invite', true],
      ['Ava', 'invite', false],
      ['Zed', 'invited', false],
      ['Sam', 'member', false],
    ]);
  });

  it('narrows by name or @handle', () => {
    expect(inviteCandidates(people, { ...opts, query: 'ma' }).map((r) => r.profile.uid)).toEqual(['m']);
    expect(inviteCandidates(people, { ...opts, query: '@zed' }).map((r) => r.profile.uid)).toEqual(['z']);
    expect(inviteCandidates(people, { ...opts, query: 'nobody' })).toEqual([]);
  });

  it('says who invited you to what', () => {
    expect(inviteTitle('Maya', 'Bass crew')).toBe('Maya invited you to Bass crew');
    expect(inviteTitle(undefined, ' ')).toBe('Someone invited you to their crew');
  });

  it('keeps invites worth showing: newest first, once per crew, not crews you’re in or from blocked people', () => {
    const i = (crewId: string, from: string, at: string): CrewInvite => ({ id: `${crewId}_me`, crewId, festivalId: 'cc4', crewName: crewId, from, to: 'me', at });
    const list = [i('c1', 'm', '2026-10-01T00:00:00Z'), i('c2', 'b', '2026-10-02T00:00:00Z'), i('c3', 'm', '2026-10-03T00:00:00Z'), i('c4', 'a', '2026-10-01T05:00:00Z'), i('c1', 'a', '2026-09-30T00:00:00Z')];
    expect(openInvites(list, { myCrews: ['c4'], blocked: new Set(['b']) }).map((x) => x.crewId)).toEqual(['c3', 'c1']);
  });
});
