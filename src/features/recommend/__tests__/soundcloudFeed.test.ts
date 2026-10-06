import { describe, expect, it } from '@jest/globals';
import { ARTISTS } from '../../../data/mock/artists';
import { CLIPS } from '../../../data/mock/clips';
import { MOCK_TASTE } from '../../../data/mock/tasteProfile';
import type { Clip } from '../../../data/types';
import type { Reaction } from '../../../state/reactions';
import { soundcloudClip } from '../../discover/soundcloud';
import { computeTaste } from '../../taste/engine';
import { rankFeed, SOUNDCLOUD_EVERY, SOUNDCLOUD_MIN_MATCH, type FeedInput } from '../feed';

/** SoundCloud cards in the feed: modest, spaced out, behind the live-set videos. */
const NOW = 1_800_000_000_000;
const none: Reaction = { liked: false, saved: false, skipped: false };
const PAGES = ARTISTS.map((a) => soundcloudClip(a.id, { url: `https://soundcloud.com/${a.id}` }, 'solstice-26'));
const isPage = (c: Clip) => c.source?.provider === 'soundcloud';

function feedFor(reactions: Record<string, Reaction> = {}, extra: Partial<FeedInput> = {}, clips: Clip[] = [...CLIPS, ...PAGES]) {
  const { taste, informed } = computeTaste(MOCK_TASTE, ARTISTS, clips, reactions);
  return rankFeed({ clips, artists: ARTISTS, taste, informed, reactions, seen: {}, now: NOW, ...extra });
}
const pageIndexes = (feed: { clip: Clip }[]) => feed.flatMap((it, i) => (isPage(it.clip) ? [i] : []));

describe('SoundCloud cards in the feed', () => {
  it('leave the live-set videos in exactly the order they had', () => {
    const without = feedFor({}, {}, CLIPS).map((it) => it.clip.id);
    const withPages = feedFor().filter((it) => !isPage(it.clip)).map((it) => it.clip.id);
    expect(withPages).toEqual(without);
  });

  it('come after five other cards at the earliest, and at most one in six, never two in a row', () => {
    const feed = feedFor();
    const at = pageIndexes(feed);
    expect(at.length).toBeGreaterThan(0);
    expect(at[0]).toBeGreaterThanOrEqual(SOUNDCLOUD_EVERY - 1);
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(SOUNDCLOUD_EVERY);
    expect(at.length).toBeLessThanOrEqual(Math.ceil(feed.length / SOUNDCLOUD_EVERY));
  });

  it('never sit beside a card of the same artist', () => {
    const feed = feedFor();
    for (const i of pageIndexes(feed)) {
      expect(feed[i - 1]?.clip.artistId).not.toBe(feed[i].clip.artistId);
      expect(feed[i + 1]?.clip.artistId).not.toBe(feed[i].clip.artistId);
    }
  });

  it('only for a decent match, best first', () => {
    const feed = feedFor();
    const { taste } = computeTaste(MOCK_TASTE, ARTISTS, [...CLIPS, ...PAGES], {});
    const shown = feed.filter((it) => isPage(it.clip)).map((it) => it.clip.artistId);
    for (const id of shown) expect(taste[id]).toBeGreaterThanOrEqual(SOUNDCLOUD_MIN_MATCH);
    expect(shown).not.toContain('john-summit');
    expect(shown[0]).toBe('illenium');
  });

  it('a weaker match shows once you’ve liked them', () => {
    const liked = Object.fromEntries(CLIPS.filter((c) => c.artistId === 'john-summit').map((c) => [c.id, { ...none, liked: true }]));
    const clips = [...CLIPS, PAGES[6]];
    const { taste } = computeTaste(MOCK_TASTE, ARTISTS, clips, liked);
    // Even with the match still low, your likes count.
    const low = { ...taste, 'john-summit': 0.3 };
    expect(rankFeed({ clips, artists: ARTISTS, taste: low, reactions: {}, seen: {}, now: NOW }).some((it) => isPage(it.clip))).toBe(false);
    expect(rankFeed({ clips, artists: ARTISTS, taste: low, reactions: liked, seen: {}, now: NOW }).some((it) => isPage(it.clip))).toBe(true);
  });

  it('never for an artist you turned down, and a skipped card doesn’t come back', () => {
    const skips = Object.fromEntries(CLIPS.filter((c) => c.artistId === 'illenium').map((c) => [c.id, { ...none, skipped: true }]));
    expect(feedFor(skips).some((it) => isPage(it.clip) && it.clip.artistId === 'illenium')).toBe(false);
    const skippedCard = { [PAGES[1].id]: { ...none, skipped: true } };
    expect(feedFor(skippedCard).some((it) => it.clip.id === PAGES[1].id)).toBe(false);
  });

  it('likes and saves on a card raise the artist like a clip’s', () => {
    const before = computeTaste(MOCK_TASTE, ARTISTS, [...CLIPS, ...PAGES], {}).taste['john-summit'];
    const after = computeTaste(MOCK_TASTE, ARTISTS, [...CLIPS, ...PAGES], { [PAGES[6].id]: { ...none, liked: true, saved: true } }).taste['john-summit'];
    expect(PAGES[6].artistId).toBe('john-summit');
    expect(after).toBeGreaterThan(before);
  });

  it('keep what’s on screen where it is, counting a card there towards the spacing', () => {
    const first = feedFor();
    const at = pageIndexes(first)[0];
    const keep = first.slice(0, at + 2).map((it) => it.clip.id);
    const again = feedFor({}, { keep });
    expect(again.slice(0, keep.length).map((it) => it.clip.id)).toEqual(keep);
    const next = pageIndexes(again).filter((i) => i > at);
    if (next.length) expect(next[0] - at).toBeGreaterThanOrEqual(SOUNDCLOUD_EVERY);
  });

  it('wait for a longer feed rather than crowd a short one', () => {
    const short = feedFor({}, {}, [...CLIPS.slice(0, 3), ...PAGES]);
    expect(pageIndexes(short)).toEqual([]);
  });
});
