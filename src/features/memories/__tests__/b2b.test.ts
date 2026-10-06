import { describe, expect, it } from '@jest/globals';
import { allArtists, b2bLine, cleanWith } from '../b2b';

describe('back to back', () => {
  it('keeps the others safely: ids, each once, never the main artist, at most three', () => {
    expect(cleanWith(['hedex', 'hedex', 'subtronics', '../x', 7, 'a', 'b', 'c'], 'subtronics')).toEqual(['hedex', 'a', 'b']);
    expect(cleanWith([], 'x')).toBeUndefined();
    expect(cleanWith('hedex')).toBeUndefined();
  });

  it('names everyone, main artist first', () => {
    expect(b2bLine(['BOOGIE T', 'SUBTRONICS'])).toBe('BOOGIE T b2b SUBTRONICS');
    expect(allArtists({ artistId: 'boogie-t', withArtistIds: ['subtronics'] })).toEqual(['boogie-t', 'subtronics']);
    expect(allArtists({ withArtistIds: ['x'] })).toEqual([]);
  });
});
