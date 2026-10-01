import { describe, expect, it } from '@jest/globals';
import type { Artist, Clip } from '../../../data/models';
import { alsoWatch, theirClips } from '../nextToWatch';

const artist = (id: string) => ({ id, name: id.toUpperCase(), sound: {} }) as Artist;
const clip = (id: string, artistId: string) => ({ id, artistId, festivalId: 'f', title: id, durationSec: 60, bpm: 140 }) as Clip;
const clips: Record<string, Clip[]> = {
  b: [clip('b1', 'b'), clip('b2', 'b')],
  c: [clip('c1', 'c')],
  d: [clip('d1', 'd')],
  e: [clip('e1', 'e')],
};
const alike: Record<string, number> = { b: 0.9, c: 0.8, d: 0.5, e: 0.1, f: 0.95 };
const sim = (_x: Artist, y: Artist) => alike[y.id] ?? 0;
const all = ['a', 'b', 'c', 'd', 'e', 'f'].map(artist);
const clipsOf = (id: string) => clips[id] ?? [];

describe('next to watch', () => {
  it('puts clips you haven’t watched first', () => {
    expect(theirClips(clips.b, { b1: 5 }).map((c) => c.id)).toEqual(['b2', 'b1']);
    expect(theirClips(clips.b, {}).map((c) => c.id)).toEqual(['b1', 'b2']);
  });

  it('fans also watch: one clip from each close artist with clips, most alike first', () => {
    const list = alsoWatch(artist('a'), all, clipsOf, sim, {});
    // F has no clips, E isn't close enough.
    expect(list.map((x) => [x.artist.id, x.clip.id])).toEqual([
      ['b', 'b1'],
      ['c', 'c1'],
      ['d', 'd1'],
    ]);
  });

  it('prefers something new: an unwatched clip of theirs, and artists you’ve fully watched go last', () => {
    const list = alsoWatch(artist('a'), all, clipsOf, sim, { b1: 1, c1: 2 });
    expect(list.map((x) => [x.clip.id, x.seen])).toEqual([
      ['b2', false],
      ['d1', false],
      ['c1', true],
    ]);
    expect(alsoWatch(artist('a'), all, clipsOf, sim, {}, { max: 1 })).toHaveLength(1);
  });
});
