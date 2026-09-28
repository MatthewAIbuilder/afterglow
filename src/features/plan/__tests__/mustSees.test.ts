import { describe, expect, it } from '@jest/globals';
import { ARTISTS } from '../../../data/artists';
import { CLIPS } from '../../../data/clips';
import { FESTIVALS } from '../../../data/festivals';
import { MOCK_TASTE } from '../../../data/tasteProfile';
import { computeTaste } from '../../taste/engine';
import { isMustSee, mustSeesAt, toggleMustSee, type MustSees } from '../mustSees';
import { buildSchedule, rankLineup } from '../plan';

// Both mock festivals book Subtronics and Sara Landry.
const A = FESTIVALS.find((f) => f.id === 'solstice-26')!;
const B = FESTIVALS.find((f) => f.id === 'horizon-27')!;
const { taste, informed } = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, {});

const plan = (stars: MustSees, festival = A) =>
  rankLineup({ festival, artists: ARTISTS, taste, informed, pinned: mustSeesAt(stars, festival.id) });
const pickOf = (stars: MustSees, festival: typeof A, id: string) =>
  plan(stars, festival).find((p) => p.artist.id === id)!;

describe('must-sees are per festival', () => {
  it('starring an artist at one festival marks them there', () => {
    const stars = toggleMustSee({}, A.id, 'sara-landry');
    expect(isMustSee(stars, A.id, 'sara-landry')).toBe(true);
    expect(pickOf(stars, A, 'sara-landry')).toMatchObject({ pinned: true, tier: 'must-see' });
  });

  it('does not star the same artist at another festival', () => {
    const stars = toggleMustSee({}, A.id, 'sara-landry');
    expect(isMustSee(stars, B.id, 'sara-landry')).toBe(false);
    expect(pickOf(stars, B, 'sara-landry')).toMatchObject({ pinned: false, tier: 'explore' });
  });

  it('starring at a second festival is its own choice', () => {
    const stars = toggleMustSee(toggleMustSee({}, A.id, 'sara-landry'), B.id, 'sara-landry');
    expect(pickOf(stars, A, 'sara-landry').pinned).toBe(true);
    expect(pickOf(stars, B, 'sara-landry').pinned).toBe(true);
  });

  it('unstarring at one festival leaves the other alone', () => {
    const both = toggleMustSee(toggleMustSee({}, A.id, 'sara-landry'), B.id, 'sara-landry');
    const stars = toggleMustSee(both, A.id, 'sara-landry');
    expect(pickOf(stars, A, 'sara-landry')).toMatchObject({ pinned: false, tier: 'explore' });
    expect(pickOf(stars, B, 'sara-landry')).toMatchObject({ pinned: true, tier: 'must-see' });
  });

  it('never changes the match, starred or not, at either festival', () => {
    const before = pickOf({}, A, 'subtronics').match;
    const starred = toggleMustSee({}, A.id, 'subtronics');
    const unstarred = toggleMustSee(starred, A.id, 'subtronics');
    for (const stars of [starred, unstarred]) {
      expect(pickOf(stars, A, 'subtronics').match).toBe(before);
      expect(pickOf(stars, B, 'subtronics').match).toBe(before);
    }
    expect(computeTaste(MOCK_TASTE, ARTISTS, CLIPS, {}).taste).toEqual(taste);
  });

  it('a star only settles clashes at its own festival', () => {
    // Excision loses Saturday's clash to Levity at Solstice unless starred there.
    const saturday = (stars: MustSees) => {
      const clash = buildSchedule(A, plan(stars)).days[1].items.find((i) => i.kind === 'clash');
      return clash?.kind === 'clash' && clash.verdict.kind !== 'close' ? clash.verdict.pick.artist.id : null;
    };
    expect(saturday(toggleMustSee({}, B.id, 'excision'))).toBe('levity');
    expect(saturday(toggleMustSee({}, A.id, 'excision'))).toBe('excision');
  });
});
