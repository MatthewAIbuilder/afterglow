import { describe, expect, it } from '@jest/globals';
import type { Artist, Clip } from '../../../data/models';
import { likedBy, pickedLine, roundLine, thisOrThatPairs, topSound } from '../thisOrThat';

const artist = (id: string, sound: Artist['sound']): Artist => ({ id, name: id.toUpperCase(), sound });
const yt = (id: string, artistId: string, festivalId = 'f'): Clip => ({
  id,
  artistId,
  festivalId,
  title: 'Live',
  durationSec: 60,
  bpm: 140,
  source: { provider: 'youtube', videoId: `v${id}`, start: 0, end: 60, channel: 'x' },
});
const artists: Record<string, Artist> = {
  d1: artist('d1', { dubstep: 1 }),
  d2: artist('d2', { dubstep: 0.8, riddim: 0.2 }),
  d3: artist('d3', { dubstep: 1 }),
  h1: artist('h1', { house: 1 }),
  h2: artist('h2', { house: 0.9 }),
  t1: artist('t1', { techno: 1 }),
  none: artist('none', {}),
};
const of = (id: string) => artists[id];

describe('this or that', () => {
  it('sets different sounds against each other, one clip per artist, YouTube sets only', () => {
    const clips = [
      yt('c1', 'd1'),
      yt('c1b', 'd1'),
      yt('c2', 'd2'),
      yt('c3', 'd3'),
      yt('c4', 'h1'),
      yt('c5', 'h2'),
      yt('c6', 't1'),
      yt('c7', 'none'),
      { ...yt('c8', 'h1'), source: undefined },
    ];
    const pairs = thisOrThatPairs(clips, of);
    // Every pair crosses sounds while two or more are left.
    for (const p of pairs.slice(0, 3)) expect(topSound(of(p.a.artistId))).not.toBe(topSound(of(p.b.artistId)));
    const used = pairs.flatMap((p) => [p.a.artistId, p.b.artistId]);
    expect(new Set(used).size).toBe(used.length);
    expect(used).not.toContain('none');
    expect(pairs).toHaveLength(3);
  });

  it('leaves out artists you already rated or reacted to, and puts your festivals first', () => {
    const clips = [yt('c1', 'd1'), yt('c4', 'h1'), yt('c2', 'd2', 'mine'), yt('c5', 'h2', 'mine')];
    const pairs = thisOrThatPairs(clips, of, { prefer: ['mine'], skip: new Set(['d1']) });
    expect([pairs[0].a.artistId, pairs[0].b.artistId].sort()).toEqual(['d2', 'h2']);
    expect(pairs.flatMap((p) => [p.a.artistId, p.b.artistId])).not.toContain('d1');
  });

  it('turns answers into likes, and says how it went', () => {
    const pair = { a: yt('a', 'd1'), b: yt('b', 'h1') };
    expect(likedBy('a', pair)).toEqual(['a']);
    expect(likedBy('b', pair)).toEqual(['b']);
    expect(likedBy('both', pair)).toEqual(['a', 'b']);
    expect(likedBy('neither', pair)).toEqual([]);
    expect(roundLine(2, 8)).toBe('Round 3 of 8');
    expect(pickedLine(1)).toBe('You picked 1 set.');
    expect(pickedLine(6)).toBe('You picked 6 sets.');
  });
});
