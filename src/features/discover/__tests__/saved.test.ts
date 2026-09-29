import { describe, expect, it } from '@jest/globals';
import type { Clip } from '../../../data/models';
import { formatDuration } from '../../festivals/format';
import { listedClips, savedClips } from '../saved';

const clip = (id: string): Clip => ({ id, artistId: 'a', festivalId: 'f', title: id, durationSec: 30, bpm: 128 });
const clips = [clip('one'), clip('two'), clip('three')];

describe('saved clips', () => {
  it('lists saved clips in catalogue order', () => {
    const reactions = {
      three: { saved: true },
      one: { saved: true },
      two: { saved: false },
      gone: { saved: true },
    };
    expect(savedClips(clips, reactions).map((c) => c.id)).toEqual(['one', 'three']);
    expect(savedClips(clips, {})).toEqual([]);
  });

  it('keeps a clip you just unsaved on the page, and adds ones saved since', () => {
    const opened = new Set(['one', 'three']);
    const now = { one: { saved: false }, two: { saved: true }, three: { saved: true } };
    expect(listedClips(clips, opened, now).map((c) => c.id)).toEqual(['one', 'two', 'three']);
  });
});

describe('clip length', () => {
  it('reads as minutes and seconds', () => {
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(125)).toBe('2:05');
    expect(formatDuration(59.6)).toBe('1:00');
    expect(formatDuration(-3)).toBe('0:00');
  });
});
