import { describe, expect, it } from '@jest/globals';
import { AUTOPLAY_COUNTDOWN_SEC, countdownTick, passFinished, upNextA11y, upNextLabel } from '../autoplay';

describe('playing the next clip', () => {
  it('a pass is finished only when played time reaches the end', () => {
    expect(passFinished(58.9, 60)).toBe(true);
    expect(passFinished(60, 60)).toBe(true);
    expect(passFinished(57, 60)).toBe(false);
    expect(passFinished(5, 0)).toBe(false);
  });

  it('counts down, then moves on', () => {
    let left: number | 'next' = AUTOPLAY_COUNTDOWN_SEC;
    const seen: (number | 'next')[] = [];
    while (left !== 'next') seen.push((left = countdownTick(left)));
    expect(seen).toEqual([2, 1, 'next']);
    expect(upNextLabel(3)).toBe('Next clip in 3');
    expect(upNextA11y(1)).toBe('Next clip in 1 second. Tap to stay on this one.');
  });
});
