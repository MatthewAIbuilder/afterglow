import { describe, expect, it } from '@jest/globals';
import { strongerWatch, watchFrom } from '../watch';

describe('watch time', () => {
  it('reads a swipe in the first seconds as passing on it', () => {
    expect(watchFrom(1.2, 45)).toBe('quick');
  });

  it('says nothing when the clip never played', () => {
    expect(watchFrom(0, 45)).toBeUndefined();
  });

  it('says nothing for a partial watch', () => {
    expect(watchFrom(20, 45)).toBeUndefined();
  });

  it('counts the end of the clip as watched through, and another round as replayed', () => {
    expect(watchFrom(41, 45)).toBe('through');
    expect(watchFrom(45, 45)).toBe('through');
    expect(watchFrom(90, 45)).toBe('replayed');
  });

  it('keeps the strongest watch, so a later quick swipe never undoes a full watch', () => {
    expect(strongerWatch('through', 'quick')).toBe('through');
    expect(strongerWatch('quick', 'replayed')).toBe('replayed');
    expect(strongerWatch(undefined, 'quick')).toBe('quick');
  });
});
