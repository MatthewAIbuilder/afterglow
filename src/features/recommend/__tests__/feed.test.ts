import { describe, expect, it } from '@jest/globals';
import { ARTISTS } from '../../../data/mock/artists';
import { CLIPS } from '../../../data/mock/clips';
import { MOCK_TASTE } from '../../../data/mock/tasteProfile';
import type { Artist, Clip } from '../../../data/types';
import type { Reaction } from '../../../state/reactions';
import { computeTaste } from '../../taste/engine';
import { ARTIST_GAP, isShort, laneOf, anchorsOf, markSeen, rankFeed, RECENT_MS, SHORT_EVERY, SHORT_GAP, type FeedInput } from '../feed';

const NOW = 1_800_000_000_000;
const none: Reaction = { liked: false, saved: false, skipped: false };

/** The live feed for a set of reactions, the way the app computes it: engine first, then ranking. */
function feedFor(reactions: Record<string, Reaction> = {}, extra: Partial<FeedInput> = {}) {
  const { taste, informed } = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, reactions);
  return rankFeed({ clips: CLIPS, artists: ARTISTS, taste, informed, reactions, seen: {}, now: NOW, ...extra });
}
const ids = (feed: { clip: Clip }[]) => feed.map((it) => it.clip.id);
const artistsIn = (feed: { clip: Clip }[]) => feed.map((it) => it.clip.artistId);
const firstOf = (feed: { clip: Clip }[], artistId: string) => feed.findIndex((it) => it.clip.artistId === artistId);
const clipsOf = (artistId: string) => CLIPS.filter((c) => c.artistId === artistId).map((c) => c.id);

describe('feed ranking', () => {
  it('includes every clip exactly once', () => {
    const feed = feedFor();
    expect([...ids(feed)].sort()).toEqual(CLIPS.map((c) => c.id).sort());
  });

  it('is deterministic', () => {
    const r = { c5: { ...none, liked: true }, c3: { ...none, skipped: true } };
    expect(ids(feedFor(r))).toEqual(ids(feedFor(r)));
  });

  it('opens with your strongest match', () => {
    expect(feedFor()[0].clip.artistId).toBe('illenium');
  });

  it('never plays the same artist twice in a row, and spaces them out when it can', () => {
    const cases: Record<string, Reaction>[] = [{}, { c5: { ...none, liked: true } }, { c1: { ...none, skipped: true } }];
    for (const r of cases) {
      // The fresh part of the feed: before clips of artists you turned down, and clips you skipped.
      const a = artistsIn(feedFor(r).filter((it) => !it.cooled && !it.skipped));
      for (let i = 1; i < a.length; i++) expect(a[i]).not.toBe(a[i - 1]);
      // With seven artists there's always room for a gap of ARTIST_GAP among the fresh clips.
      for (let i = ARTIST_GAP; i < 7; i++) expect(a.slice(i - ARTIST_GAP, i)).not.toContain(a[i]);
    }
  });

  it('lets strong matches rise', () => {
    // John Summit starts as a weak match. Liking and saving his clips moves him up the feed.
    const before = firstOf(feedFor(), 'john-summit');
    const loved = Object.fromEntries(clipsOf('john-summit').map((id) => [id, { ...none, liked: true, saved: true }]));
    // A fresh session: the clips you loved were seen a while ago, not just now.
    const after = firstOf(feedFor(loved), 'john-summit');
    expect(after).toBeLessThan(before);
    expect(feedFor(loved).find((it) => it.clip.artistId === 'john-summit')!.lane).toBe('personal');
  });

  it('lets skipped artists fall', () => {
    const before = firstOf(feedFor(), 'tape-b');
    const skipped = { [clipsOf('tape-b')[0]]: { ...none, skipped: true } };
    const feed = feedFor(skipped);
    expect(firstOf(feed, 'tape-b')).toBeGreaterThan(before);
    // The skipped clip itself goes to the very end.
    expect(feed[feed.length - 1].clip.id).toBe(clipsOf('tape-b')[0]);
  });

  it('holds back clips you saw recently until the fresh ones are through', () => {
    const top = feedFor()[0].clip.id;
    const feed = feedFor({}, { seen: { [top]: NOW - 60_000 } });
    const at = ids(feed).indexOf(top);
    expect(at).toBe(CLIPS.length - 1);
    expect(feed[at].seenRecently).toBe(true);
  });

  it('brings back clips seen longer ago first, and forgets views outside the recent window', () => {
    const [a, b] = clipsOf('illenium');
    const feed = feedFor({}, { seen: { [a]: NOW - 60_000, [b]: NOW - 3 * 60 * 60 * 1000 } });
    expect(ids(feed).indexOf(b)).toBeLessThan(ids(feed).indexOf(a));

    const old = feedFor({}, { seen: { [a]: NOW - RECENT_MS - 1 } });
    expect(old.find((it) => it.clip.id === a)!.seenRecently).toBe(false);
  });

  it('keeps what is already on screen in place and re-ranks only what comes after', () => {
    const initial = ids(feedFor());
    const keep = initial.slice(0, 2);
    const later = feedFor({ [initial[5]]: { ...none, skipped: true } }, { keep });
    expect(ids(later).slice(0, 2)).toEqual(keep);
    expect(ids(later)).toHaveLength(CLIPS.length);
    expect(ids(later)[CLIPS.length - 1]).toBe(initial[5]);
  });

  it('keeps explicit actions stronger than passive watching', () => {
    // One like on one of John Summit's clips beats replaying every clip of his.
    const [first] = clipsOf('john-summit');
    const liked = feedFor({ [first]: { ...none, liked: true } });
    const replayed = feedFor(
      Object.fromEntries(clipsOf('john-summit').map((id) => [id, { ...none, watched: 'replayed' as const }])),
    );
    const score = (feed: ReturnType<typeof feedFor>) => feed.find((it) => it.clip.id === clipsOf('john-summit')[1])!.score;
    expect(score(liked)).toBeGreaterThan(score(replayed));
    // And a skip sends a clip to the back even if you had watched it through.
    const feed = feedFor({ c1: { ...none, skipped: true, watched: 'through' } });
    expect(feed[feed.length - 1].clip.id).toBe('c1');
  });
});

describe('lanes', () => {
  // A small world to make relationships obvious.
  const A: Artist = { id: 'a', name: 'A', sound: { dubstep: 1 } }; // your favourite
  const B: Artist = { id: 'b', name: 'B', sound: { dubstep: 0.8, riddim: 0.4 } }; // close to A, middling match
  const C: Artist = { id: 'c', name: 'C', sound: { house: 1 } }; // a different sound
  const D: Artist = { id: 'd', name: 'D', sound: { techno: 1 } }; // unknown: no prior, no signal
  const E: Artist = { id: 'e', name: 'E', sound: { dubstep: 0.9 } }; // another favourite
  const artists = [A, B, C, D, E];
  const taste = { a: 0.95, b: 0.55, c: 0.5, d: 0.5, e: 0.9 };
  const informed = { a: true, b: true, c: true, d: false, e: true };
  const clips: Clip[] = [];
  for (const x of artists)
    for (let i = 0; i < 4; i++) clips.push({ id: `${x.id}${i}`, artistId: x.id, festivalId: 'f', title: '', durationSec: 30, bpm: 128 });
  const feed = rankFeed({ clips, artists, taste, informed, reactions: {}, seen: {}, now: NOW });

  it('sorts artists into personal, explore and discover', () => {
    const anchors = anchorsOf(artists, taste, informed);
    expect(anchors.map((a) => a.id)).toEqual(['a', 'e']);
    expect(laneOf(A, taste, anchors, informed).lane).toBe('personal');
    expect(laneOf(B, taste, anchors, informed)).toMatchObject({ lane: 'explore', reason: { kind: 'near', artistId: 'a' } });
    expect(laneOf(C, taste, anchors, informed)).toMatchObject({ lane: 'discover', reason: { kind: 'new-sound' } });
    expect(laneOf(D, taste, anchors, informed)).toMatchObject({ lane: 'discover', reason: { kind: 'unknown' } });
  });

  it('lets related artists surface early', () => {
    expect(firstOf(feed, 'b')).toBeLessThan(4);
  });

  it('still shows artists it knows nothing about', () => {
    expect(firstOf(feed, 'd')).toBeLessThan(8);
    expect(feed.find((it) => it.clip.artistId === 'd')!.reason.kind).toBe('unknown');
  });

  it('keeps most of the feed personal, explores regularly, and takes new directions only occasionally', () => {
    const first12 = feed.slice(0, 12);
    const count = (lane: string) => first12.filter((it) => it.lane === lane).length;
    expect(count('personal')).toBeGreaterThanOrEqual(6);
    expect(count('explore')).toBeGreaterThanOrEqual(2);
    expect(count('discover')).toBeGreaterThanOrEqual(1);
    expect(count('discover')).toBeLessThanOrEqual(3);
    expect(feed[0].lane).toBe('personal');
  });

  it('falls back to other lanes when one runs dry', () => {
    const onlyFavourites = rankFeed({ clips: clips.filter((c) => c.artistId === 'a' || c.artistId === 'e'), artists, taste, informed, reactions: {}, seen: {}, now: NOW });
    expect(onlyFavourites).toHaveLength(8);
  });
});

describe('several clips per artist (the nightly import keeps up to four sets each)', () => {
  // Every artist with four clips: their own, then copies standing in for more sets.
  const many: Clip[] = ARTISTS.flatMap((a) => {
    const own = CLIPS.filter((c) => c.artistId === a.id);
    if (!own.length) return [];
    return [0, 1, 2, 3].map((n) => ({ ...own[n % own.length], id: `${a.id}-set${n}` }));
  });
  const feedOf = (reactions: Record<string, Reaction> = {}) => {
    const { taste, informed } = computeTaste(MOCK_TASTE, ARTISTS, many, reactions);
    return rankFeed({ clips: many, artists: ARTISTS, taste, informed, reactions, seen: {}, now: NOW });
  };
  const positions = (feed: { clip: Clip }[], artistId: string) => feed.flatMap((it, i) => (it.clip.artistId === artistId ? [i] : []));
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

  it('spaces one artist’s sets apart, never back to back', () => {
    const cases: Record<string, Reaction>[] = [{}, { 'illenium-set0': { ...none, liked: true } }, { 'tape-b-set0': { ...none, skipped: true } }];
    for (const r of cases) {
      const feed = feedOf(r);
      expect(feed).toHaveLength(many.length);
      const a = artistsIn(feed.filter((it) => !it.cooled && !it.skipped));
      for (let i = 1; i < a.length; i++) expect(a[i]).not.toBe(a[i - 1]);
      // Room for a gap of ARTIST_GAP while several artists are still left.
      for (let i = ARTIST_GAP; i < a.length - 8; i++) expect(a.slice(i - ARTIST_GAP, i)).not.toContain(a[i]);
    }
  });

  it('brings a liked artist’s other sets forward, and holds back a skipped artist’s', () => {
    const before = feedOf();
    const liked = feedOf({ 'john-summit-set0': { ...none, liked: true, saved: true } });
    const others = (feed: { clip: Clip }[]) => positions(feed, 'john-summit').filter((i) => feed[i].clip.id !== 'john-summit-set0');
    expect(mean(others(liked))).toBeLessThan(mean(others(before)));

    const skipped = feedOf({ 'illenium-set0': { ...none, skipped: true } });
    const rest = positions(skipped, 'illenium').filter((i) => skipped[i].clip.id !== 'illenium-set0');
    expect(mean(rest)).toBeGreaterThan(mean(positions(before, 'illenium')));
    // Turned down: their other sets wait until every fresh clip from someone else has played.
    const lastFresh = skipped.findLastIndex((it) => !it.cooled && !it.skipped);
    for (const i of rest) expect(i).toBeGreaterThan(lastFresh);
  });
});

describe('Shorts in the feed', () => {
  // Every artist with four long sets and two Shorts (the nightly caps).
  const short = (c: Clip, n: number): Clip => ({
    ...c,
    id: `${c.artistId}-short${n}`,
    durationSec: 40,
    source: { provider: 'youtube', videoId: `${c.artistId}x${n}`.padEnd(11, 'x').slice(0, 11), start: 0, end: 40, channel: 'Fan', vertical: true, short: true },
  });
  const mixed: Clip[] = ARTISTS.flatMap((a) => {
    const own = CLIPS.find((c) => c.artistId === a.id);
    if (!own) return [];
    return [0, 1, 2, 3].map((n) => ({ ...own, id: `${a.id}-set${n}` })).concat([short(own, 0), short(own, 1)]);
  });

  it('mixes Shorts in, never two close together while there are sets to put between, never one artist twice in a row', () => {
    const { taste, informed } = computeTaste(MOCK_TASTE, ARTISTS, mixed, {});
    const feed = rankFeed({ clips: mixed, artists: ARTISTS, taste, informed, reactions: {}, seen: {}, now: NOW });
    expect(feed).toHaveLength(mixed.length);
    const shorts = feed.map((it) => isShort(it.clip));
    expect(shorts.indexOf(true)).toBe(SHORT_EVERY - 1); // mixed in early, not left to the end
    // A Short at least every SHORT_EVERY cards while there are any…
    const at = shorts.flatMap((s, i) => (s ? [i] : []));
    for (let k = 1; k < at.length; k++) expect(at[k] - at[k - 1]).toBeLessThanOrEqual(SHORT_EVERY);
    // …and never closer than SHORT_GAP while there are sets to put between.
    const lastSet = shorts.lastIndexOf(false);
    for (let i = 1; i < lastSet; i++) if (shorts[i]) expect(shorts.slice(Math.max(0, i - SHORT_GAP), i)).not.toContain(true);
    const a = artistsIn(feed);
    for (let i = 1; i < a.length; i++) expect(a[i]).not.toBe(a[i - 1]);
    expect(isShort(mixed[0])).toBe(false);
  });
});

describe('seen history', () => {
  it('records the latest view and stays bounded', () => {
    let h = markSeen({}, 'c1', 1);
    h = markSeen(h, 'c1', 5);
    expect(h.c1).toBe(5);
    for (let i = 0; i < 20; i++) h = markSeen(h, `x${i}`, 10 + i, 10);
    expect(Object.keys(h)).toHaveLength(10);
    expect(h.x19).toBe(29);
    expect(h.c1).toBeUndefined();
  });
});
