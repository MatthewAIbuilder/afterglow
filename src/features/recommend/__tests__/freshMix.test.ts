import { describe, expect, it } from '@jest/globals';
import { ARTISTS } from '../../../data/mock/artists';
import { CLIPS } from '../../../data/mock/clips';
import { MOCK_TASTE } from '../../../data/mock/tasteProfile';
import { computeTaste } from '../../taste/engine';
import { fade, rankFeed, RECENT_MS, SEEN_FADE_MS, shuffleOf, type FeedInput } from '../feed';

/** "Your mix is always the exact same videos": what you saw this week waits, and each opening shuffles near-ties. */
const NOW = 1_800_000_000_000;
const DAY = 24 * 3600_000;
const { taste, informed } = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, {});
const feed = (extra: Partial<FeedInput> = {}) => rankFeed({ clips: CLIPS, artists: ARTISTS, taste, informed, reactions: {}, seen: {}, now: NOW, ...extra }).map((it) => it.clip.id);

describe('a fresh mix every time', () => {
  it('a clip seen earlier this week is held back, less each day, and not at all after a week', () => {
    expect(fade(undefined, NOW)).toBe(0);
    expect(fade(NOW - RECENT_MS / 2, NOW)).toBe(0);
    expect(fade(NOW - RECENT_MS, NOW)).toBe(1);
    expect(fade(NOW - DAY * 3, NOW)).toBeGreaterThan(fade(NOW - DAY * 5, NOW));
    expect(fade(NOW - SEEN_FADE_MS, NOW)).toBe(0);
  });

  it('yesterday’s first clips don’t lead again today', () => {
    const before = feed();
    const top = before.slice(0, 3);
    // Seen yesterday (outside the 6-hour window that used to be all that counted).
    const seen = Object.fromEntries(top.map((id) => [id, NOW - DAY]));
    const today = feed({ seen });
    expect(today.slice(0, 3)).not.toEqual(top);
    for (const id of top) expect(today.indexOf(id)).toBeGreaterThan(2);
    // A week later they're as good as new.
    expect(feed({ seen: Object.fromEntries(top.map((id) => [id, NOW - SEEN_FADE_MS - DAY])) }).slice(0, 3)).toEqual(top);
  });

  it('each opening shuffles near-equal matches; the same opening always gives the same order', () => {
    const shuffles = [2, 3, 4, 5, 6].map((seed) => feed({ seed }).join());
    expect(new Set(shuffles).size).toBeGreaterThan(1);
    expect(feed({ seed: 3 })).toEqual(feed({ seed: 3 }));
    expect(shuffleOf(3, 'c1')).toBe(shuffleOf(3, 'c1'));
    expect(shuffleOf(3, 'c1')).toBeGreaterThanOrEqual(0);
    expect(shuffleOf(3, 'c1')).toBeLessThan(1);
  });

  it('taste still leads: the shuffle never sends your strongest match to the bottom half', () => {
    const best = feed()[0];
    for (const seed of [2, 7, 11, 19, 42]) {
      const order = feed({ seed });
      expect(order.indexOf(best)).toBeLessThan(order.length / 2);
    }
  });
});
