import { describe, expect, it } from '@jest/globals';
import { createCatalog, soundcloudCardId, withoutClips } from '../catalog';
import { parseCatalogFile } from '../file';
import { buildCatalog, mergeSnapshots } from '../merge';
import type { CatalogSnapshot } from '../models';
import { validateSnapshot } from '../validate';

/** SoundCloud pages in the catalogue: an artist's own link, and the nightly matches. */
const base: CatalogSnapshot = {
  artists: [
    { id: 'a', name: 'A', sound: {} },
    { id: 'b', name: 'B', sound: {}, soundcloud: 'https://soundcloud.com/b-own' },
  ],
  festivals: [{ id: 'f', name: 'F', dates: 'Soon', location: '', days: [], stages: [], lineup: ['a', 'b'] }],
  clips: [{ id: 'c1', artistId: 'a', festivalId: 'f', title: 'Set', durationSec: 30, bpm: 128 }],
};

describe('SoundCloud in the catalogue file', () => {
  it('reads an artist’s own link, and explains a bad one plainly', () => {
    const parsed = parseCatalogFile({
      version: 1,
      artists: [
        { id: 'x', name: 'X', soundcloud: 'https://www.soundcloud.com/x-music/' },
        { id: 'y', name: 'Y', soundcloud: 'https://open.spotify.com/artist/1' },
      ],
    });
    expect(parsed.snapshot!.artists[0].soundcloud).toBe('https://soundcloud.com/x-music');
    expect(parsed.snapshot!.artists[1].soundcloud).toBeUndefined();
    expect(parsed.problems).toEqual(['Artist "y": the SoundCloud link should look like https://soundcloud.com/their-name, so it was ignored.']);
  });

  it('reads the nightly matches, leaving out bad entries with one plain note', () => {
    const parsed = parseCatalogFile({
      version: 1,
      soundcloud: {
        a: { url: 'https://soundcloud.com/a', name: 'A', image: 'https://i1.sndcdn.com/avatars-1-t500x500.jpg' },
        'bad id!': { url: 'https://soundcloud.com/z' },
        c: { url: 'https://example.com/c' },
      },
      soundcloudMisses: { d: '2026-10-01' },
    });
    expect(parsed.snapshot!.soundcloud).toEqual({ a: { url: 'https://soundcloud.com/a', name: 'A', image: 'https://i1.sndcdn.com/avatars-1-t500x500.jpg' } });
    expect(parsed.problems).toEqual(['2 SoundCloud links were left out: each needs an artist id and a link like https://soundcloud.com/their-name.']);
    expect(parseCatalogFile({ version: 1, soundcloud: ['x'] }).problems[0]).toMatch(/^"soundcloud" should be written as/);
  });

  it('quietly drops matches for artists not on Afterglow', () => {
    const checked = validateSnapshot({ ...base, soundcloud: { a: { url: 'https://soundcloud.com/a' }, gone: { url: 'https://soundcloud.com/gone' } } });
    expect(checked.snapshot.soundcloud).toEqual({ a: { url: 'https://soundcloud.com/a' } });
    expect(checked.problems).toEqual([]);
  });

  it('joins the matches of two catalogues, the second winning', () => {
    const merged = mergeSnapshots(
      { ...base, soundcloud: { a: { url: 'https://soundcloud.com/old' }, b: { url: 'https://soundcloud.com/b' } } },
      { artists: [], festivals: [], clips: [], soundcloud: { a: { url: 'https://soundcloud.com/new' } } },
    );
    expect(merged.soundcloud).toEqual({ a: { url: 'https://soundcloud.com/new' }, b: { url: 'https://soundcloud.com/b' } });
  });

  it('comes through a hosted file onto the catalogue', () => {
    const built = buildCatalog(base, parseCatalogFile({ version: 1, soundcloud: { a: { url: 'https://soundcloud.com/a-page' } } }));
    expect(built.problems).toEqual([]);
    expect(built.catalog.soundcloudOf('a')).toEqual({ url: 'https://soundcloud.com/a-page' });
  });
});

describe('the catalogue’s SoundCloud pages', () => {
  const catalog = createCatalog({ ...base, soundcloud: { a: { url: 'https://soundcloud.com/a' }, b: { url: 'https://soundcloud.com/b-matched' } } });

  it('a link set on the artist always wins over the nightly match', () => {
    expect(catalog.soundcloudOf('b')).toEqual({ url: 'https://soundcloud.com/b-own' });
    expect(catalog.soundcloudOf('a')).toEqual({ url: 'https://soundcloud.com/a' });
    expect(catalog.soundcloudOf('nobody')).toBeUndefined();
  });

  it('flagging an artist’s SoundCloud card hides their page, even one set on the artist', () => {
    const hidden = withoutClips(catalog, new Set([soundcloudCardId('a'), soundcloudCardId('b')]));
    expect(hidden.soundcloudOf('a')).toBeUndefined();
    expect(hidden.soundcloudOf('b')).toBeUndefined();
    expect(hidden.clips).toHaveLength(1);
  });

  it('keeps the pages when other clips are flagged, and is the same object when nothing applies', () => {
    expect(withoutClips(catalog, new Set(['c1'])).soundcloudOf('a')).toEqual({ url: 'https://soundcloud.com/a' });
    expect(withoutClips(catalog, new Set(['nothing']))).toBe(catalog);
  });
});
