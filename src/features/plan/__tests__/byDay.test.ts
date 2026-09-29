import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { EXPLORE_PER_DAY, picksByDay } from '../byDay';
import type { Pick } from '../plan';

const festival: Festival = {
  id: 'f',
  name: 'F',
  dates: '',
  location: '',
  lineup: ['a', 'b', 'c', 'd', 'e', 'x1', 'x2', 'x3', 'x4', 'nod'],
  days: ['Friday', 'Saturday'],
  stages: [],
  artistDays: { a: ['Friday'], b: ['Friday'], c: ['Saturday'], d: ['Friday', 'Saturday'], e: ['Friday'], x1: ['Friday'], x2: ['Friday'], x3: ['Friday'], x4: ['Friday'] },
};
const pick = (id: string, match: number, tier: Pick['tier'], pinned = false, known = true): Pick => ({
  artist: { id, name: id.toUpperCase(), sound: {} },
  match,
  tier,
  pinned,
  known,
});
const picks = [
  pick('a', 0.8, 'strong'),
  pick('b', 0.95, 'must-see'),
  pick('c', 0.9, 'must-see'),
  pick('d', 0.76, 'strong'),
  pick('e', 0.5, 'must-see', true),
  pick('x1', 0.6, 'explore'),
  pick('x2', 0.7, 'explore'),
  pick('x3', 0.5, 'explore', false, false),
  pick('x4', 0.4, 'explore'),
  pick('nod', 0.8, 'strong'),
];
const ids = (list: Pick[]) => list.map((p) => p.artist.id);

describe('your picks day by day', () => {
  it('lists each day starred first, then must-sees, then by match', () => {
    const { days } = picksByDay(festival, picks);
    expect(days.map((d) => d.day)).toEqual(['Friday', 'Saturday']);
    expect(ids(days[0].planned)).toEqual(['e', 'b', 'a', 'd']);
    expect(ids(days[1].planned)).toEqual(['c', 'd']);
  });

  it('adds a few picks to explore under each day, ones with real signal first', () => {
    const { days } = picksByDay(festival, picks);
    expect(days[0].explore).toHaveLength(EXPLORE_PER_DAY);
    expect(ids(days[0].explore)).toEqual(['x2', 'x1', 'x4']);
    expect(days[1].explore).toEqual([]);
  });

  it('keeps planned picks with no day aside', () => {
    expect(ids(picksByDay(festival, picks).noDay)).toEqual(['nod']);
  });
});
