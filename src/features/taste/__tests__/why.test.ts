import { describe, expect, it } from '@jest/globals';
import type { Clip } from '../../../data/models';
import { artistSignals, whyLine } from '../why';

const clip = (id: string, artistId: string): Clip => ({ id, artistId, festivalId: 'f', title: id, durationSec: 30, bpm: 128 });
const clips = [clip('a1', 'a'), clip('a2', 'a'), clip('a3', 'a'), clip('b1', 'b')];
const r = (liked: boolean, saved: boolean, skipped: boolean, watched?: string) => ({ liked, saved, skipped, watched });

describe('why a match is what it is', () => {
  it('counts your signals on the artist’s clips, and your rating', () => {
    const reactions = {
      a1: r(true, true, false, 'through'),
      a2: r(true, false, false),
      a3: r(false, false, true, 'through'),
      b1: r(true, false, false),
    };
    expect(artistSignals('a', clips, reactions, { a: 'love' })).toEqual({
      likes: 2,
      saves: 1,
      skips: 1,
      watched: 1,
      rating: 'love',
    });
  });

  it('reads as a plain sentence', () => {
    expect(whyLine({ likes: 2, saves: 1, skips: 0, watched: 0, rating: 'love' }, true)).toBe(
      'From your rating, 2 likes and 1 save',
    );
    expect(whyLine({ likes: 0, saves: 0, skips: 1, watched: 0 }, true)).toBe('From your 1 skip');
    expect(whyLine({ likes: 0, saves: 0, skips: 0, watched: 3 }, true)).toBe('From your 3 clips watched through');
    expect(whyLine({ likes: 0, saves: 0, skips: 0, watched: 0, rating: 'pass' }, true)).toBe(
      'From your rating',
    );
  });

  it('falls back to similar sounds, or a first guess', () => {
    const none = { likes: 0, saves: 0, skips: 0, watched: 0 };
    expect(whyLine(none, true)).toBe('From sounds you like');
    expect(whyLine(none, false)).toMatch(/^A first guess/);
    // Lifted only by sounding like your library: says so, naming the service.
    expect(whyLine(none, true, ['Spotify'])).toBe('Close to artists in your Spotify library');
    // Your own signal comes first.
    expect(whyLine({ ...none, likes: 1 }, true, ['Spotify'])).toBe('From your 1 like');
  });
});
