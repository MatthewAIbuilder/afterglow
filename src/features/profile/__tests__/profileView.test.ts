import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import type { Memory } from '../../memories/models';
import { festivalMark, profileHighlights, profileStats, shortCount, videoGrid } from '../profileView';

const fest = (id: string, name: string): Festival => ({ id, name, dates: '', location: '', days: [], stages: [], lineup: [] });
const memory = (id: string, capturedAt: string, addedAt = capturedAt): Memory => ({ id, file: `${id}.mov`, capturedAt, addedAt });

describe('profile view', () => {
  it('counts followers and following with a profile, then festivals, artists, moments and badges for everyone', () => {
    expect(profileStats({ social: true, festivals: 2, followers: 1, following: 12, artists: 5, moments: 3, badges: 1 }).map((s) => [s.label, s.n, s.a11y])).toEqual([
      ['Followers', 1, '1 follower'],
      ['Following', 12, '12 following'],
      ['Festivals', 2, '2 festivals'],
      ['Artists', 5, '5 artists rated'],
      ['Moments', 3, '3 moments'],
      ['Badges', 1, '1 badge'],
    ]);
    expect(profileStats({ social: true, festivals: 1, following: 0, artists: 0, moments: 0, badges: 0 })[0].a11y).toBe('Followers');
    expect(profileStats({ social: false, festivals: 1, following: 0, artists: 1, moments: 4, badges: 0 }).map((s) => s.a11y)).toEqual(['1 festival', '1 artist rated', '4 moments', '0 badges']);
  });

  it('keeps big counts short', () => {
    expect([shortCount(999), shortCount(1234), shortCount(12_500), shortCount(2_500_000)]).toEqual(['999', '1.2K', '12K', '2.5M']);
  });

  it('puts festivals first, then your year, then recaps', () => {
    const h = profileHighlights({ going: [{ festival: fest('cc', 'Cyclops Cove 4'), when: 'In 2 months' }], year: { year: 2026, soFar: true }, recaps: [fest('edc', 'EDC Orlando 2026')] });
    expect(h.map((x) => [x.kind, x.title, x.detail])).toEqual([
      ['festival', 'Cyclops Cove 4', 'In 2 months'],
      ['year', 'Your 2026', 'So far'],
      ['recap', 'EDC Orlando 2026', 'Recap'],
    ]);
    expect(profileHighlights({ going: [], recaps: [] })).toEqual([]);
  });

  it('shows the newest videos first', () => {
    const grid = videoGrid([memory('a', '2026-06-01T20:00:00Z'), memory('b', '2026-06-02T20:00:00Z'), memory('c', '2026-06-01T20:00:00Z', '2026-06-03T00:00:00Z')]);
    expect(grid.map((m) => m.id)).toEqual(['b', 'c', 'a']);
  });

  it('marks festivals with their initials, years left out', () => {
    expect([festivalMark('Cyclops Cove 4'), festivalMark('EDC Orlando 2026'), festivalMark('Austin City Limits 2026'), festivalMark('Solstice 2026')]).toEqual(['CC4', 'EO', 'ACL', 'S']);
  });
});
