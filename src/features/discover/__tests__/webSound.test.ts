import { describe, expect, it } from '@jest/globals';
import { afterGesture, afterRefusal, autoplayVerdict, BUFFER_PATIENCE_MS, startMuted, YT_STATE } from '../webSound';

describe('sound on the website', () => {
  it('counts a playing (or looped) clip as started', () => {
    expect(autoplayVerdict(YT_STATE.playing, 1500)).toBe('started');
    expect(autoplayVerdict(YT_STATE.ended, 1500)).toBe('started');
  });

  it('lets a slow clip keep loading with its sound, then leaves it be', () => {
    expect(autoplayVerdict(YT_STATE.buffering, 1500)).toBe('loading');
    expect(autoplayVerdict(YT_STATE.buffering, BUFFER_PATIENCE_MS - 1)).toBe('loading');
    expect(autoplayVerdict(YT_STATE.buffering, BUFFER_PATIENCE_MS)).toBe('give-up');
  });

  it('treats a clip that never started, or was paused by the browser, as refused', () => {
    expect(autoplayVerdict(undefined, 1500)).toBe('refused');
    expect(autoplayVerdict(YT_STATE.unstarted, 1500)).toBe('refused');
    expect(autoplayVerdict(YT_STATE.cued, 1500)).toBe('refused');
    expect(autoplayVerdict(YT_STATE.paused, 1500)).toBe('refused');
  });

  it('starts later clips muted after a refusal, until the page is touched again', () => {
    expect(startMuted({ refused: false })).toBe(false);
    expect(startMuted(afterRefusal())).toBe(true);
    expect(startMuted(afterGesture())).toBe(false);
  });
});
