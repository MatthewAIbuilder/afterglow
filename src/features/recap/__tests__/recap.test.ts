import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../../../data/bundled';
import { festivalRecap, hasRecap, recapArtists, recapNotices, recapText, type RecapInput } from '../recap';

const { catalog } = BUILT_IN;
const cyclops = catalog.festival('cyclops-cove-4')!;
const after = new Date(2026, 11, 20); // Dec 20 2026, after Dec 4 to 6
const before = new Date(2026, 10, 1);
const input = (over: Partial<RecapInput> = {}): RecapInput => ({
  festival: cyclops,
  going: true,
  memories: [
    { artistId: 'subtronics', night: 'Saturday' },
    { artistId: 'subtronics', night: 'Saturday' },
    { artistId: 'levity', night: 'Friday' },
    { night: 'Friday' },
  ],
  stars: new Set(['kompany']),
  ratings: { troyboi: 'love', avello: 'like', ravenscoon: 'pass' },
  taste: {},
  artist: catalog.artist,
  today: after,
  ...over,
});

describe('festival recap', () => {
  it('is there once the festival is over and you were part of it', () => {
    expect(hasRecap(input())).toBe(true);
    expect(hasRecap(input({ today: before }))).toBe(false);
    expect(hasRecap(input({ going: false, memories: [], stars: new Set() }))).toBe(false);
    expect(hasRecap(input({ going: false, stars: new Set() }))).toBe(true);
    expect(festivalRecap(input({ today: before }))).toBeUndefined();
  });

  it('ranks your artists: filmed, then starred, then loved', () => {
    const lineup = new Set(cyclops.lineup);
    const onIt = ['subtronics', 'levity', 'kompany', 'troyboi', 'avello'].filter((a) => lineup.has(a));
    const ids = recapArtists(input()).map((a) => a.artist.id);
    expect(ids).toEqual(onIt);
    expect(ids).not.toContain('ravenscoon');
  });

  it('makes a card with your artists, nights, sound and numbers', () => {
    const card = festivalRecap(input())!;
    expect(card.title).toBe('Cyclops Cove 4');
    expect(card.subtitle).toMatch(/· Your recap$/);
    const artists = card.sections.find((s) => s.heading === 'Your artists')!;
    expect(artists.lines[0]).toEqual({ name: 'SUBTRONICS', star: false, where: '2 videos' });
    expect(card.sections.find((s) => s.heading === 'Your nights')!.lines).toEqual([
      { name: 'Friday', where: '2 videos', star: false },
      { name: 'Saturday', where: '2 videos', star: false },
    ]);
    const sound = card.sections.find((s) => s.heading === 'Your sound there')!;
    expect(sound.lines.length).toBeGreaterThan(0);
    expect(sound.lines.every((l) => /^\d{1,3}%$/.test(l.where!))).toBe(true);
    expect(card.sections.find((s) => s.heading === 'By the numbers')!.lines.map((l) => [l.name, l.where])).toContainEqual(['Videos filmed', '4']);
    const text = recapText(card);
    expect(text.split('\n')[0]).toBe('My Cyclops Cove 4');
    expect(text).toContain('SUBTRONICS, 2 videos');
    expect(text.trim().endsWith('Made with Afterglow')).toBe(true);
  });

  it('the bell says a recap is ready, for two months after', () => {
    expect(recapNotices([cyclops], after)).toEqual([
      { id: 'recap:cyclops-cove-4', kind: 'recap', festivalId: 'cyclops-cove-4', href: '/recap/cyclops-cove-4', title: 'Your recap of Cyclops Cove 4 is ready', body: 'Your artists, nights and sound there, ready to share.' },
    ]);
    expect(recapNotices([cyclops], new Date(2027, 2, 1))).toEqual([]);
    expect(recapNotices([cyclops], before)).toEqual([]);
  });

  it('adds the sets you saw (and how they were), how far you walked and your fit checks', () => {
    const card = festivalRecap(input({ seen: [{ artistId: 'levity', verdict: 'unreal' }, { artistId: 'kompany' }], walkedMeters: 12400, miles: false, fits: 2 }))!;
    const artists = card.sections.find((x) => x.heading === 'Your artists')!;
    expect(artists.lines[0]).toEqual(expect.objectContaining({ name: 'LEVITY', where: expect.stringMatching(/^Unreal/) }));
    const numbers = card.sections.find((x) => x.heading === 'By the numbers')!.lines.map((l) => [l.name, l.where]);
    expect(numbers).toEqual(expect.arrayContaining([['Sets you saw', '2'], ['Walked', '12 km'], ['Fit checks', '2']]));
    // Seeing a set is enough for a recap.
    expect(hasRecap(input({ going: false, memories: [], stars: new Set(), seen: [{ artistId: 'levity' }] }))).toBe(true);
  });
});
