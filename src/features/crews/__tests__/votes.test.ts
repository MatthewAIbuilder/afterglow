import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/types';
import { clashLine, clashSlots, cleanVotes, type CrewVotes, mergeStars, nextToVote, starsFromVotes, tallyClash, tallyLineup, wanted } from '../votes';

const v = (uid: string, lineup: CrewVotes['lineup'], clashes: CrewVotes['clashes'] = {}): CrewVotes => ({ uid, lineup, clashes, at: '' });
const members = ['a', 'b', 'c'];
const lineup = ['x', 'y', 'z', 'w'];

describe('voting on the lineup', () => {
  it('ranks the lineup by the crew’s total, leaving out acts nobody voted on and anyone who left', () => {
    const votes = [v('a', { x: 2, y: 1, z: 0 }), v('b', { x: 2, y: 2 }), v('c', { x: 2, z: 1 }), v('gone', { w: 2 })];
    const rows = tallyLineup(votes, members, lineup);
    expect(rows.map((r) => [r.artistId, r.score, r.everyone])).toEqual([
      ['x', 6, true],
      ['y', 3, false],
      ['z', 1, false],
    ]);
    expect(nextToVote(votes[1], lineup)).toBe('z');
    expect(nextToVote(votes[1], lineup, new Set(['z']))).toBe('w');
  });

  it('reads back votes whatever their shape', () => {
    expect(cleanVotes('a', { lineup: { x: 2, y: 5, z: '1' }, clashes: { k: 'x', j: 3 } })).toEqual({ uid: 'a', lineup: { x: 2 }, clashes: { k: 'x' }, at: '' });
    expect(cleanVotes('a', null)).toBeUndefined();
  });

  it('finds the clashes between acts the crew wants, and settles them', () => {
    const festival = {
      id: 'f', name: 'F', dates: '', location: '', lineup, days: ['Friday'], stages: [{ id: 's1', name: 'Main' }, { id: 's2', name: 'Tent' }],
      sets: [
        { artistId: 'x', day: 'Friday', stageId: 's1', start: '22:00', end: '23:00' },
        { artistId: 'y', day: 'Friday', stageId: 's2', start: '22:30', end: '23:30' },
        { artistId: 'z', day: 'Friday', stageId: 's1', start: '23:30', end: '00:30' },
      ],
    } as Festival;
    const votes = [v('a', { x: 2, y: 2, z: 1 }), v('b', { x: 2 }), v('c', { y: 2 })];
    const rows = tallyLineup(votes, members, lineup);
    expect([...wanted(rows)].sort()).toEqual(['x', 'y']);
    const [slot, ...more] = clashSlots(festival, wanted(rows));
    expect(more).toEqual([]);
    expect(slot.key).toBe('Friday|x+y');
    const picked = [v('a', {}, { [slot.key]: 'x' }), v('b', {}, { [slot.key]: 'x' }), v('c', {}, { [slot.key]: 'y' })];
    const result = tallyClash(slot, picked, members);
    expect(result).toEqual({ counts: { x: ['a', 'b'], y: ['c'] }, winner: 'x', tie: false, voted: 3 });
    expect(clashLine(slot, result, (id) => id.toUpperCase(), 3)).toBe('2 of 3: X over Y');
    expect(tallyClash(slot, picked.slice(1), members).tie).toBe(true);
    // The crew's choices as stars for "Our route": Must sees, and the winner for everyone.
    const stars = starsFromVotes([...votes.map((x, i) => ({ ...x, clashes: picked[i].clashes }))], members, [slot]);
    expect(stars).toEqual({ a: ['x', 'y'], b: ['x'], c: ['y', 'x'] });
    expect(mergeStars({ a: ['q'] }, stars).a).toEqual(['q', 'x', 'y']);
  });
});
