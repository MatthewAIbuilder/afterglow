import { describe, expect, it } from '@jest/globals';
import { alreadyKnown, cleanHints, currentHint, type Hint } from '../hints';

describe('first-time tips', () => {
  it('shows one tip at a time, in order, until all are done', () => {
    expect(currentHint(new Set<Hint>())).toBe('swipe');
    expect(currentHint(new Set<Hint>(['swipe']))).toBe('like');
    expect(currentHint(new Set<Hint>(['like']))).toBe('swipe');
    expect(currentHint(new Set<Hint>(['swipe', 'like']))).toBeUndefined();
  });

  it('skips tips for people who already use the app', () => {
    expect(alreadyKnown(0, {})).toEqual([]);
    expect(alreadyKnown(1, {})).toEqual([]);
    expect(alreadyKnown(3, {})).toEqual(['swipe']);
    expect(alreadyKnown(0, { c1: { liked: false, saved: true } })).toEqual(['like']);
    expect(alreadyKnown(0, { c1: { liked: false, saved: false } })).toEqual([]);
  });

  it('reads back only real tips', () => {
    expect(cleanHints(['like', 'nope', 3])).toEqual(['like']);
    expect(cleanHints('swipe')).toEqual([]);
    expect(cleanHints(null)).toEqual([]);
  });
});
