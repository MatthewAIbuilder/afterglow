import { describe, expect, it } from '@jest/globals';
import type { Artist } from '../../../data/models';
import { listView, mainSounds, rankArtists } from '../list';

const a = (id: string, name: string, sound: Artist['sound']): Artist => ({ id, name, sound });
const artists = [
  a('wooli', 'WOOLI', { dubstep: 1 }),
  a('illenium', 'ILLENIUM', { 'melodic-bass': 1, dubstep: 0.25 }),
  a('lorde', 'LORDE', { pop: 0.9, indie: 0.6 }),
  a('xx', 'THE XX', { indie: 0.9 }),
  a('dubby', 'DUB CLUB', {}),
  a('svdden', 'SVDDEN DEATH', { dubstep: 0.9, riddim: 0.8 }),
];
const taste = { wooli: 0.4, illenium: 0.9, lorde: 0.4, xx: 0.2, dubby: 0.1, svdden: 0.7 };
// The app knows nothing yet about THE XX or SVDDEN DEATH.
const informed = { wooli: true, illenium: true, lorde: true, dubby: true };
const ranking = rankArtists(artists, taste, informed);
const ids = (rows: { artist: Artist }[]) => rows.map((r) => r.artist.id);

describe('the My Sound list', () => {
  it('names the sounds an artist carries most, strongest first', () => {
    expect(mainSounds(artists[5])).toEqual(['dubstep', 'riddim']);
    expect(mainSounds(artists[2])).toEqual(['pop', 'indie']);
    // Only a little of everything: still their strongest one.
    expect(mainSounds(a('x', 'X', { techno: 0.3, house: 0.2 }))).toEqual(['techno']);
    expect(mainSounds(artists[4])).toEqual([]);
    expect(mainSounds(a('x', 'X', { techno: 0.9, house: 0.8, pop: 0.7 }))).toEqual(['techno', 'house']);
  });

  it('ranks the artists the app knows about, best match first (ties by name), and keeps the rest apart', () => {
    expect(ids(ranking.ranked)).toEqual(['illenium', 'lorde', 'wooli', 'dubby']);
    expect(ranking.ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(ranking.ranked[0].match).toBe(0.9);
    expect(ids(ranking.rest)).toEqual(['svdden', 'xx']);
    expect(ranking.rest.every((r) => r.rank === undefined)).toBe(true);
  });

  it('shows ranked artists, with the rest a tap away', () => {
    const view = listView(ranking);
    expect(ids(view.rows)).toEqual(['illenium', 'lorde', 'wooli', 'dubby']);
    expect(view.hidden).toBe(2);
    const all = listView(ranking, { showRest: true });
    expect(ids(all.rows)).toEqual(['illenium', 'lorde', 'wooli', 'dubby', 'svdden', 'xx']);
    expect(all.hidden).toBe(0);
  });

  it('counts each sound the listed artists carry, and filters to one', () => {
    expect(listView(ranking).counts).toEqual([
      { tag: 'melodic-bass', count: 1 },
      { tag: 'dubstep', count: 1 },
      { tag: 'pop', count: 1 },
      { tag: 'indie', count: 1 },
    ]);
    const dub = listView(ranking, { sound: 'dubstep' });
    expect(ids(dub.rows)).toEqual(['wooli']);
    // Counts don't shrink to the chosen sound, so the other chips still say how many.
    expect(dub.counts.length).toBe(4);
    // SVDDEN DEATH is dubstep too, but waits with the rest.
    expect(dub.hidden).toBe(1);
    expect(ids(listView(ranking, { sound: 'dubstep', showRest: true }).rows)).toEqual(['wooli', 'svdden']);
  });

  it('searches by name or sound like the map, reaching everyone', () => {
    const dub = listView(ranking, { query: 'dub' });
    expect(dub.search?.sounds).toEqual(['dubstep']);
    expect(ids(dub.rows)).toEqual(['wooli', 'dubby', 'svdden']);
    expect(dub.hidden).toBe(0);
    expect(ids(listView(ranking, { query: 'the x' }).rows)).toEqual(['xx']);
    expect(listView(ranking, { query: 'zzz' }).rows).toEqual([]);
    expect(listView(ranking, { query: '  ' }).search).toBeUndefined();
  });

  it('sorts A to Z, keeping each artist’s rank', () => {
    const view = listView(ranking, { sort: 'name', showRest: true });
    expect(view.rows.map((r) => r.artist.name)).toEqual(['DUB CLUB', 'ILLENIUM', 'LORDE', 'SVDDEN DEATH', 'THE XX', 'WOOLI']);
    expect(view.rows[1].rank).toBe(1);
    expect(view.rows[3].rank).toBeUndefined();
  });

  it('a festival with nobody known yet lists nothing until asked', () => {
    const empty = rankArtists([artists[3], artists[5]], taste, informed);
    expect(listView(empty).rows).toEqual([]);
    expect(listView(empty).hidden).toBe(2);
  });
});
