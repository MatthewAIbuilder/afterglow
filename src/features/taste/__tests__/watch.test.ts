import { describe, expect, it } from '@jest/globals';
import { canCountWatch, clipPlayback, playedSpan } from '../../discover/playback';
import {
  addPlayed,
  coveredSec,
  excuseWatch,
  mergeWatch,
  QUICK_MAX_SEC,
  startWatch,
  watchOf,
  type WatchSession,
} from '../watch';

const LENGTH = 45;
const CLIP_START = 1500; // the clip's section starts 25 minutes into the video

/** Feed a session YouTube-style reports every 250ms from `from` to `to` (video time), the way YouTubePlayer does. */
function play(s: WatchSession, from: number, to: number, eligible = true) {
  let prev: number | null = null;
  for (let t = from; t <= to + 1e-9; t += 0.25) {
    const span = playedSpan(prev, t, eligible, CLIP_START);
    if (span) s = addPlayed(s, span.from, span.to);
    prev = t;
  }
  return s;
}
const clip = (sec: number) => CLIP_START + sec;

describe('watch session', () => {
  it('says nothing when a clip only loaded and never played', () => {
    expect(watchOf(startWatch(LENGTH))).toBeUndefined();
  });

  it('says nothing for playback that was hidden, backgrounded or not live', () => {
    const hidden = clipPlayback(1, 0, true); // not the clip on screen
    const background = clipPlayback(0, 0, false); // on screen, but Discover hidden or app in background
    for (const p of [hidden, background]) {
      const s = play(startWatch(LENGTH), clip(0), clip(LENGTH), canCountWatch(p, true));
      expect(s.playedSec).toBe(0);
      expect(watchOf(s)).toBeUndefined();
    }
  });

  it('reads watching most of a clip as watched through', () => {
    expect(watchOf(play(startWatch(LENGTH), clip(0), clip(41)))).toBe('through');
    expect(watchOf(play(startWatch(LENGTH), clip(0), clip(30)))).toBeUndefined();
  });

  it('reads a swipe after a couple of seconds as a quick pass, but not a flick before anything showed', () => {
    expect(watchOf(play(startWatch(LENGTH), clip(0), clip(2)))).toBe('quick');
    expect(watchOf(play(startWatch(LENGTH), clip(0), clip(0.5)))).toBeUndefined();
    expect(watchOf(play(startWatch(LENGTH), clip(0), clip(QUICK_MAX_SEC + 1)))).toBeUndefined();
  });

  it('does not call it a quick pass when you left Discover or opened the artist', () => {
    const s = excuseWatch(play(startWatch(LENGTH), clip(0), clip(2)));
    expect(watchOf(s)).toBeUndefined();
  });

  it('never counts the same seconds twice in a pass', () => {
    let s = play(startWatch(LENGTH), clip(0), clip(20));
    // The same stretch reported again, and watched again after seeking back.
    s = addPlayed(s, 5, 6);
    s = addPlayed(s, 5, 6);
    s = play(s, clip(0), clip(20));
    expect(coveredSec(s.covered)).toBeCloseTo(20);
    expect(watchOf(s)).toBeUndefined();
    // Seeking back and forth over the first half can never make it "watched through".
    for (let i = 0; i < 10; i++) s = play(s, clip(0), clip(20));
    expect(s.passes).toBe(0);
    expect(watchOf(s)).toBeUndefined();
  });

  it('ignores seeks, stalls and time outside the clip', () => {
    let s = startWatch(LENGTH);
    s = addPlayed(s, 0, 30); // a jump, not playback
    s = addPlayed(s, 44, 50); // past the end
    s = addPlayed(s, -3, -1); // before the start
    s = addPlayed(s, 10, 9); // backwards
    s = addPlayed(s, NaN, 1);
    expect(coveredSec(s.covered)).toBeLessThanOrEqual(1);
    expect(watchOf(s)).toBeUndefined();
  });

  it('counts a replay only after a full pass and most of another', () => {
    // First pass, the player loops back to the top, then half again.
    let s = play(startWatch(LENGTH), clip(0), clip(44.75));
    expect(watchOf(s)).toBe('through');
    s = play(s, clip(0), clip(10));
    expect(watchOf(s)).toBe('through');
    s = play(s, clip(0), clip(30));
    expect(watchOf(s)).toBe('replayed');
  });

  it('a clip with no length never says anything', () => {
    expect(watchOf(play(startWatch(0), clip(0), clip(10)))).toBeUndefined();
  });
});

describe('folding watches into a clip', () => {
  it('keeps the strongest, so a later quick swipe never undoes a full watch', () => {
    expect(mergeWatch('through', 'quick')).toBe('through');
    expect(mergeWatch('quick', 'through')).toBe('through');
    expect(mergeWatch(undefined, 'quick')).toBe('quick');
    expect(mergeWatch('quick', undefined)).toBe('quick');
  });

  it('counts watching it through again on a later visit as a replay', () => {
    expect(mergeWatch('through', 'through')).toBe('replayed');
  });

  it('is bounded: coming back again and again never goes past replayed', () => {
    let w = mergeWatch(undefined, 'through');
    for (let i = 0; i < 50; i++) w = mergeWatch(w, i % 2 ? 'replayed' : 'through');
    expect(w).toBe('replayed');
  });
});
