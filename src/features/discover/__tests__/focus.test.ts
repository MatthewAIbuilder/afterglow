import { describe, expect, it } from '@jest/globals';
import type { Artist, Clip, Festival } from '../../../data/models';
import { focusChoices, FOLLOWING, inSound, isWide, MIX, mixContext, nextDiscoverFocus, soundChoices, soundFocus, soundOf, startFocus } from '../focus';

const fest = (id: string, lineup: string[], startDate?: string): Festival => ({
  id,
  name: id,
  dates: '',
  location: '',
  lineup,
  days: [],
  stages: [],
  startDate,
  endDate: startDate,
});
const clip = (id: string, artistId: string, festivalId: string): Clip => ({ id, artistId, festivalId, title: 't', durationSec: 30, bpm: 128 });

// a: x, y (two clips). b: y, z (two clips, y's shared with a). c: w, no clips.
const festivals = [fest('a', ['x', 'y'], '2026-12-01'), fest('b', ['y', 'z'], '2026-11-01'), fest('c', ['w'])];
const clips = [clip('c1', 'x', 'a'), clip('c2', 'y', 'a'), clip('c3', 'z', 'b')];
const today = new Date(2026, 8, 29);

describe('Discover focus', () => {
  it('opens on what you picked last, if it still has clips', () => {
    expect(startFocus(festivals, clips, [], 'b')).toBe('b');
    expect(startFocus(festivals, clips, [], MIX)).toBe(MIX);
    expect(startFocus(festivals, clips, [], 'c')).toBe('a');
    expect(startFocus(festivals, clips, [], 'gone')).toBe('a');
  });

  it('otherwise opens on a festival you are going to with clips, then the one with the most', () => {
    expect(startFocus(festivals, clips, ['c', 'b'], null)).toBe('b');
    expect(startFocus(festivals, clips, ['c'], null)).toBe('a');
    expect(startFocus(festivals, clips, [])).toBe('a');
  });

  it('Following: remembered like the mix, kept for a video from the crowd, left for an official clip', () => {
    expect(startFocus(festivals, clips, [], FOLLOWING)).toBe(FOLLOWING);
    expect(nextDiscoverFocus('a', { festival: FOLLOWING }, festivals)).toBe(FOLLOWING);
    const crowd: Clip = {
      ...clip('community:s1', 'z', 'b'),
      source: { provider: 'community', videoUrl: 'https://x/v.mp4', handle: 'maya', uid: 'u1', sharedId: 's1', capturedAt: '', vertical: true },
    };
    expect(nextDiscoverFocus(FOLLOWING, { clip: crowd }, festivals)).toBe(FOLLOWING);
    expect(nextDiscoverFocus(FOLLOWING, { clip: clips[2] }, festivals)).toBe('b');
    expect(isWide(FOLLOWING) && isWide(MIX) && !isWide('a')).toBe(true);
  });

  it('moves to what it is asked for', () => {
    expect(nextDiscoverFocus('a', { festival: 'b' }, festivals)).toBe('b');
    expect(nextDiscoverFocus('a', { festival: MIX }, festivals)).toBe(MIX);
    expect(nextDiscoverFocus('a', { festival: 'gone' }, festivals)).toBe('a');
    expect(nextDiscoverFocus('a', {}, festivals)).toBe('a');
  });

  it('keeps the mix for a clip, and moves a festival focus only when the artist is not there', () => {
    expect(nextDiscoverFocus(MIX, { clip: clips[2] }, festivals)).toBe(MIX);
    expect(nextDiscoverFocus('a', { clip: clips[1] }, festivals)).toBe('a');
    expect(nextDiscoverFocus('a', { clip: clips[2] }, festivals)).toBe('b');
    expect(nextDiscoverFocus('c', { clip: clip('c9', 'nobody', 'a') }, festivals)).toBe('c');
  });

  it('shows a mix clip against a festival you are going to when the artist plays it', () => {
    expect(mixContext(clips[1], festivals, [])?.id).toBe('a');
    expect(mixContext(clips[1], festivals, ['b'])?.id).toBe('b');
    expect(mixContext(clips[0], festivals, ['b'])?.id).toBe('a');
  });

  it('offers festivals you are going to first, then others with clips', () => {
    const none = focusChoices(festivals, clips, [], today);
    expect(none.going).toEqual([]);
    expect(none.others.map((c) => [c.festival.id, c.clips])).toEqual([
      ['a', 2],
      ['b', 2],
    ]);
    const mine = focusChoices(festivals, clips, ['a', 'c', 'b'], today);
    expect(mine.going.map((c) => [c.festival.id, c.clips])).toEqual([
      ['b', 2],
      ['a', 2],
      ['c', 0],
    ]);
    expect(mine.others).toEqual([]);
  });

  it('focuses on one sound from every lineup', () => {
    expect(soundFocus('dubstep')).toBe('sound:dubstep');
    expect(soundOf('sound:dubstep')).toBe('dubstep');
    expect(soundOf('sound:polka')).toBeUndefined();
    expect(soundOf(MIX)).toBeUndefined();
    expect(isWide('sound:house')).toBe(true);
    expect(startFocus(festivals, clips, [], 'sound:house')).toBe('sound:house');
    expect(startFocus(festivals, clips, [], 'sound:polka')).not.toBe('sound:polka');
    expect(nextDiscoverFocus('a', { festival: 'sound:trap' }, festivals)).toBe('sound:trap');
    // A clip link from a sound goes to the mix, which has every clip.
    expect(nextDiscoverFocus('sound:trap', { clip: clips[0] }, festivals)).toBe(MIX);
  });

  it('offers sounds that have enough clips, most first', () => {
    const artists: Record<string, Artist> = {
      x: { id: 'x', name: 'X', sound: { dubstep: 0.9 } },
      y: { id: 'y', name: 'Y', sound: { dubstep: 0.6, house: 0.5 } },
      z: { id: 'z', name: 'Z', sound: { house: 0.4 } },
    };
    const artist = (id: string) => artists[id];
    expect(inSound(clips[0], 'dubstep', artist)).toBe(true);
    expect(inSound(clips[2], 'house', artist)).toBe(false);
    expect(soundChoices(clips, artist, 1)).toEqual([
      { tag: 'dubstep', clips: 2 },
      { tag: 'house', clips: 1 },
    ]);
    expect(soundChoices(clips, artist)).toEqual([]);
  });
});
