import { describe, expect, it } from '@jest/globals';
import type { Clip } from '../../../data/models';
import { formatDuration } from '../../festivals/format';
import { listedClips, openedWith, savedClips, yourClipCount, yourClips } from '../saved';

const clip = (id: string): Clip => ({ id, artistId: 'a', festivalId: 'f', title: id, durationSec: 30, bpm: 128 });
const clips = [clip('one'), clip('two'), clip('three')];

describe('your clips', () => {
  const r = (saved: boolean, liked: boolean) => ({ saved, liked });

  it('lists saved and liked clips in catalogue order, each once', () => {
    const reactions = { three: r(true, false), one: r(true, true), two: r(false, true), gone: r(true, true) };
    const mine = yourClips(clips, reactions);
    expect(mine.saved.map((c) => c.id)).toEqual(['one', 'three']);
    expect(mine.liked.map((c) => c.id)).toEqual(['two']);
    expect(yourClipCount(mine)).toBe(3);
    expect(savedClips(clips, reactions).map((c) => c.id)).toEqual(['one', 'three']);
    expect(yourClipCount(yourClips(clips, {}))).toBe(0);
  });

  it('keeps a clip you just unsaved or unliked on the page, and adds new ones', () => {
    const opened = openedWith(yourClips(clips, { one: r(true, false), two: r(false, true) }));
    // One unsaved, two unliked, three newly liked.
    const now = { one: r(false, false), two: r(false, false), three: r(false, true) };
    const listed = listedClips(clips, opened, now);
    expect(listed.saved.map((c) => c.id)).toEqual(['one']);
    expect(listed.liked.map((c) => c.id)).toEqual(['two', 'three']);
  });

  it('moves nothing twice: a liked clip you then save shows under Saved only', () => {
    const opened = openedWith(yourClips(clips, { two: r(false, true) }));
    const listed = listedClips(clips, opened, { two: r(true, true) });
    expect(listed.saved.map((c) => c.id)).toEqual(['two']);
    expect(listed.liked).toEqual([]);
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
