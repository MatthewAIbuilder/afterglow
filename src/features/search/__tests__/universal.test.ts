import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../../../data/bundled';
import { addRecent, cleanRecents, liveRecents, recentsFor, RECENTS_MAX, removeRecent, searchCatalog, searchesPeople, topArtists } from '../universal';

const catalog = BUILT_IN.catalog;

describe('search everything', () => {
  it('finds festivals and artists together', () => {
    const f = searchCatalog('edc', catalog);
    expect(f.festivals.map((x) => x.id)).toContain('edc-orlando-26');
    expect(f.peopleOnly).toBe(false);
    expect(searchCatalog('subtro', catalog).artists.map((a) => a.id)).toContain('subtronics');
    // Equally good name matches: your best match first.
    expect(searchCatalog('subtro', catalog, { subtronics: 0.96 }).artists[0].id).toBe('subtronics');
    expect(searchCatalog('   ', catalog)).toEqual({ festivals: [], artists: [], peopleOnly: false });
  });

  it('"@" looks for people only, from two letters', () => {
    expect(searchCatalog('@sub', catalog)).toEqual({ festivals: [], artists: [], peopleOnly: true });
    expect(searchesPeople('@m')).toBe(false);
    expect(searchesPeople('@ma')).toBe(true);
    expect(searchesPeople('ma')).toBe(true);
  });

  it('remembers recent searches, newest first, once each', () => {
    let r = addRecent([], { kind: 'artist', id: 'a', label: 'A' });
    r = addRecent(r, { kind: 'festival', id: 'f', label: 'F' });
    r = addRecent(r, { kind: 'artist', id: 'a', label: 'A' });
    expect(r.map((x) => x.id)).toEqual(['a', 'f']);
    for (let i = 0; i < 20; i++) r = addRecent(r, { kind: 'person', id: `p${i}`, label: 'P' });
    expect(r).toHaveLength(RECENTS_MAX);
    expect(removeRecent(r, r[0])).toHaveLength(RECENTS_MAX - 1);
    expect(cleanRecents([{ kind: 'artist', id: 'a', label: 'A' }, { kind: 'x', id: 'b', label: 'B' }, 3])).toEqual([{ kind: 'artist', id: 'a', label: 'A' }]);
    expect(liveRecents([{ kind: 'artist', id: 'gone', label: 'G' }, { kind: 'person', id: 'maya', label: 'Maya' }], { festival: () => true, artist: () => false })).toHaveLength(1);
  });

  it('top matches are the best informed artists', () => {
    const artists = catalog.artists.slice(0, 3);
    const taste = { [artists[0].id]: 0.5, [artists[1].id]: 0.9, [artists[2].id]: 0.99 };
    expect(topArtists(artists, taste, { [artists[0].id]: true, [artists[1].id]: true }).map((a) => a.id)).toEqual([artists[1].id, artists[0].id]);
  });
});

describe('recents per account', () => {
  it('shows people only to the account that looked them up', () => {
    const list = cleanRecents([
      { kind: 'person', id: 'maya', label: 'Maya', by: 'u1' },
      { kind: 'person', id: 'old', label: 'Old' },
      { kind: 'festival', id: 'f', label: 'F' },
    ]);
    expect(recentsFor(list, 'u1').map((r) => r.id)).toEqual(['maya', 'f']);
    expect(recentsFor(list, 'u2').map((r) => r.id)).toEqual(['f']);
    expect(recentsFor(list, undefined).map((r) => r.id)).toEqual(['f']);
  });
});
