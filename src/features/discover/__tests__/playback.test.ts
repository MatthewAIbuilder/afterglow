import { describe, expect, it } from '@jest/globals';
import {
  canCountWatch,
  clipPlayback,
  COMMAND_GRACE_MS,
  feedIsLive,
  MAX_TICK_SEC,
  pageAfterDrag,
  playedBetween,
  readPlayerReport,
  shouldPlay,
  showPoster,
} from '../playback';

/** Every clip in a feed of `count`, as the feed would hand them out. */
const feed = (count: number, activeIndex: number, focused: boolean, appState: string) =>
  Array.from({ length: count }, (_, i) => clipPlayback(i, activeIndex, feedIsLive(focused, appState)));

describe('playback lifecycle', () => {
  it('Discover visible and the clip active: plays and may count watching', () => {
    const [clip] = feed(3, 0, true, 'active');
    expect(clip).toEqual({ active: true, live: true });
    expect(shouldPlay(clip, false)).toBe(true);
    expect(canCountWatch(clip, true)).toBe(true);
  });

  it('leaving Discover (another tab or a pushed page) stops the clip', () => {
    const [clip] = feed(3, 0, false, 'active');
    expect(clip.active).toBe(true);
    expect(clip.live).toBe(false);
    expect(shouldPlay(clip, false)).toBe(false);
    expect(canCountWatch(clip, true)).toBe(false);
  });

  it('backgrounding the app stops the clip', () => {
    for (const state of ['background', 'inactive']) {
      const [clip] = feed(3, 0, true, state);
      expect(clip.live).toBe(false);
      expect(shouldPlay(clip, false)).toBe(false);
      expect(canCountWatch(clip, true)).toBe(false);
    }
  });

  it('treats an unknown app state as foreground', () => {
    expect(feedIsLive(true, 'unknown')).toBe(true);
    expect(feedIsLive(true, null)).toBe(true);
  });

  it('a new active clip makes the previous one inactive', () => {
    const before = feed(3, 0, true, 'active');
    const after = feed(3, 1, true, 'active');
    expect(before[0].live).toBe(true);
    expect(after[0]).toEqual({ active: false, live: false });
    expect(after[1]).toEqual({ active: true, live: true });
    expect(after.filter((c) => c.live)).toHaveLength(1);
  });

  it('returning to Discover resumes the same active clip, unless you paused it', () => {
    const away = feed(3, 2, false, 'active');
    const back = feed(3, 2, true, 'active');
    expect(away.some((c) => shouldPlay(c, false))).toBe(false);
    expect(back.map((c) => shouldPlay(c, false))).toEqual([false, false, true]);
    // You paused it before leaving: it stays paused.
    expect(shouldPlay(back[2], true)).toBe(false);
  });

  it('returning to the foreground resumes the active clip', () => {
    const [bg] = feed(1, 0, true, 'background');
    const [fg] = feed(1, 0, true, 'active');
    expect(shouldPlay(bg, false)).toBe(false);
    expect(shouldPlay(fg, false)).toBe(true);
  });

  it('never has more than one live clip', () => {
    for (let active = 0; active < 5; active++) {
      expect(feed(5, active, true, 'active').filter((c) => c.live)).toHaveLength(1);
      expect(feed(5, active, false, 'active').filter((c) => c.live)).toHaveLength(0);
    }
  });
});

describe('watch signals', () => {
  it('hidden clips cannot generate watch time, even if playing', () => {
    const [, hidden] = feed(2, 0, true, 'active');
    expect(canCountWatch(hidden, true)).toBe(false);
    expect(playedBetween(10, 10.25, canCountWatch(hidden, true))).toBe(0);
  });

  it('nothing counts while Discover is hidden or the app is backgrounded', () => {
    for (const [focused, state] of [
      [false, 'active'],
      [true, 'background'],
    ] as const) {
      const [clip] = feed(1, 0, focused, state);
      expect(playedBetween(10, 10.25, canCountWatch(clip, true))).toBe(0);
    }
  });

  it('a live clip that is not actually playing does not count', () => {
    const [clip] = feed(1, 0, true, 'active');
    expect(canCountWatch(clip, false)).toBe(false);
  });

  it('counts real playback between reports', () => {
    expect(playedBetween(10, 10.25, true)).toBeCloseTo(0.25);
  });

  it('ignores the first report, seeks and loops', () => {
    expect(playedBetween(null, 10, true)).toBe(0);
    expect(playedBetween(40, 0, true)).toBe(0); // loop back to the start
    expect(playedBetween(10, 10 + MAX_TICK_SEC + 1, true)).toBe(0); // jump ahead
  });
});

describe('player reports', () => {
  const settled = COMMAND_GRACE_MS + 1;

  it('stops a hidden player that starts playing', () => {
    expect(readPlayerReport('playing', { live: false, wantPlaying: false, msSinceCommand: 0 })).toBe('force-pause');
    expect(readPlayerReport('playing', { live: false, wantPlaying: false, msSinceCommand: settled })).toBe('force-pause');
  });

  it('a pause while hidden is ours, not yours', () => {
    expect(readPlayerReport('paused', { live: false, wantPlaying: false, msSinceCommand: settled })).toBeUndefined();
  });

  it('follows the player controls on a live clip', () => {
    expect(readPlayerReport('paused', { live: true, wantPlaying: true, msSinceCommand: settled })).toBe('user-paused');
    expect(readPlayerReport('playing', { live: true, wantPlaying: false, msSinceCommand: settled })).toBe('user-played');
  });

  it('ignores late reports right after our own command', () => {
    expect(readPlayerReport('paused', { live: true, wantPlaying: true, msSinceCommand: 100 })).toBeUndefined();
    expect(readPlayerReport('playing', { live: true, wantPlaying: false, msSinceCommand: 100 })).toBeUndefined();
  });

  it('reports that agree with what we asked change nothing', () => {
    expect(readPlayerReport('playing', { live: true, wantPlaying: true, msSinceCommand: settled })).toBeUndefined();
    expect(readPlayerReport('paused', { live: true, wantPlaying: false, msSinceCommand: settled })).toBeUndefined();
  });
});

describe('showPoster', () => {
  it('stays up until the player is ready', () => {
    expect(showPoster({ ready: false, hasPlayed: false, waitedLong: true })).toBe(true);
  });

  it('stays up while a ready player has not started', () => {
    expect(showPoster({ ready: true, hasPlayed: false, waitedLong: false })).toBe(true);
  });

  it('goes once the video plays, or after waiting too long', () => {
    expect(showPoster({ ready: true, hasPlayed: true, waitedLong: false })).toBe(false);
    expect(showPoster({ ready: true, hasPlayed: false, waitedLong: true })).toBe(false);
  });
});

describe('pageAfterDrag', () => {
  const H = 800;

  it('moves one page for a long drag or a flick', () => {
    expect(pageAfterDrag(2, 10, -200, 0, H)).toBe(3);
    expect(pageAfterDrag(2, 10, 200, 0, H)).toBe(1);
    expect(pageAfterDrag(2, 10, -30, -900, H)).toBe(3);
    expect(pageAfterDrag(2, 10, 30, 900, H)).toBe(1);
  });

  it('springs back for a short, slow drag', () => {
    expect(pageAfterDrag(2, 10, -40, -100, H)).toBe(2);
  });

  it('does not flick against the drag direction', () => {
    expect(pageAfterDrag(2, 10, 20, -900, H)).toBe(2);
  });

  it('stays within the feed', () => {
    expect(pageAfterDrag(0, 10, 300, 0, H)).toBe(0);
    expect(pageAfterDrag(9, 10, -300, 0, H)).toBe(9);
  });
});
