import { describe, expect, it } from '@jest/globals';
import { MOCK_CATALOG, MOCK_TASTE } from '../../../data/mock';
import type { Reaction } from '../../../state/reactions';
import { BUILT_IN } from '../../../data/bundled';
import { tuneQueue, leftToRate } from '../../festivals/tune';
import { rankLineup } from '../../plan/plan';
import { rankFeed } from '../../recommend/feed';
import { artistsOnMap } from '../../sound-map/layout';
import { computeTaste, RATING_WEIGHT, WEIGHT, RATED } from '../engine';
import { cleanRatings, rate } from '../ratings';

const { artists, clips } = MOCK_CATALOG;
const none: Reaction = { liked: false, saved: false, skipped: false };
const clipOf = (artistId: string) => clips.find((c) => c.artistId === artistId)!.id;

describe('artist ratings', () => {
  it('sets, changes and clears a rating, leaving the rest alone', () => {
    let r = rate({}, 'a', 'love');
    expect(r).toEqual({ a: 'love' });
    r = rate(r, 'b', 'pass');
    expect(rate(r, 'a', 'love')).toBe(r); // no change, same object
    expect(rate(r, 'a', undefined)).toEqual({ b: 'pass' });
  });

  it('keeps only well-formed ratings from storage', () => {
    expect(cleanRatings({ a: 'love', b: 'pass', c: 'meh', d: 1 })).toEqual({ a: 'love', b: 'pass' });
    expect(cleanRatings(null)).toEqual({});
    expect(cleanRatings([1])).toEqual({});
  });
});

describe('ratings in the taste engine', () => {
  it('counts a love like saving one of their clips, and a pass like skipping one, for similar sounds', () => {
    expect(RATING_WEIGHT.love).toBe(WEIGHT.save);
    expect(RATING_WEIGHT.pass).toBe(WEIGHT.skip);
    const loved = computeTaste(MOCK_TASTE, artists, clips, {}, undefined, { 'john-summit': 'love' });
    const saved = computeTaste(MOCK_TASTE, artists, clips, { [clipOf('john-summit')]: { ...none, saved: true } });
    // The spill-over to everyone else is the same as a save.
    for (const a of artists) if (a.id !== 'john-summit') expect(loved.taste[a.id]).toBeCloseTo(saved.taste[a.id]);
    const passed = computeTaste(MOCK_TASTE, artists, clips, {}, undefined, { 'sara-landry': 'pass' });
    expect(passed.taste['sara-landry']).toBeLessThan(MOCK_TASTE['sara-landry']);
  });

  it('takes a rating at its word for the artist: love is at least a strong match, pass leaves your plan', () => {
    const { taste } = computeTaste({}, artists, clips, {}, undefined, { 'john-summit': 'love', illenium: 'pass' });
    expect(taste['john-summit']).toBeGreaterThanOrEqual(RATED.love);
    expect(taste.illenium).toBeLessThanOrEqual(RATED.pass);
    // Already higher (or lower) stays where it is.
    const high = computeTaste(MOCK_TASTE, artists, clips, {}, undefined, { illenium: 'love' });
    expect(high.taste.illenium).toBeGreaterThan(MOCK_TASTE.illenium - 0.001);
  });

  it('spills over to similar sounds and teaches it about artists with no prior', () => {
    const { taste, informed } = computeTaste({}, artists, clips, {}, undefined, { excision: 'love' });
    expect(informed.excision).toBe(true);
    expect(informed.levity).toBe(true);
    expect(taste.levity).toBeGreaterThan(0.5);
    expect(informed['john-summit']).toBe(false);
  });

  it('ignores ratings for artists it doesn’t know', () => {
    const { taste } = computeTaste(MOCK_TASTE, artists, clips, {}, undefined, { nobody: 'love' });
    for (const [id, v] of Object.entries(MOCK_TASTE)) expect(taste[id]).toBeCloseTo(v);
  });
});

describe('ratings in the feed', () => {
  const run = (ratings: Record<string, 'love' | 'pass'>) => {
    const { taste, informed } = computeTaste(MOCK_TASTE, artists, clips, {}, undefined, ratings);
    return rankFeed({ clips, artists, taste, informed, reactions: {}, seen: {}, now: 0, ratings });
  };

  it('holds back an artist you said is not for you', () => {
    const before = run({}).findIndex((it) => it.clip.artistId === 'tape-b');
    const feed = run({ 'tape-b': 'pass' });
    expect(feed.findIndex((it) => it.clip.artistId === 'tape-b')).toBeGreaterThan(before);
    expect(feed.find((it) => it.clip.artistId === 'tape-b')!.cooled).toBe(true);
  });

  it('raises an artist you love, and never lowers them', () => {
    const score = (feed: ReturnType<typeof run>) => feed.find((it) => it.clip.artistId === 'john-summit')!.score;
    const before = run({});
    const after = run({ 'john-summit': 'love' });
    expect(score(after)).toBeGreaterThan(score(before));
    const at = (feed: ReturnType<typeof run>) => feed.findIndex((it) => it.clip.artistId === 'john-summit');
    expect(at(after)).toBeLessThanOrEqual(at(before));
  });
});

describe('tune your lineup', () => {
  const edc = BUILT_IN.catalog.festival('edc-orlando-26')!;
  const isArtist = (id: string) => !!BUILT_IN.catalog.artist(id);

  it('goes through the lineup in order, skipping anyone already rated', () => {
    const queue = tuneQueue(edc, { 'aaron-hibell': 'love', levity: 'pass' }, isArtist);
    expect(queue[0]).toBe('a-little-sound');
    expect(queue).not.toContain('aaron-hibell');
    expect(queue).not.toContain('levity');
    expect(queue.length).toBe(edc.lineup.length - 2);
    expect(leftToRate(edc, {}, isArtist)).toBe(110);
    expect(tuneQueue(edc, {}, (id) => id === 'levity')).toEqual(['levity']);
  });

  it('turns a few ratings into a real plan and a bigger My Sound', () => {
    const { catalog } = BUILT_IN;
    const ratings = { wooli: 'love', 'ray-volpe': 'love', 'i-hate-models': 'pass' } as const;
    const { taste, informed } = computeTaste(MOCK_TASTE, catalog.artists, catalog.clips, {}, undefined, ratings);
    const picks = rankLineup({ festival: edc, artists: catalog.artists, taste, informed });
    const top = picks.slice(0, 6).map((p) => p.artist.id);
    expect(top).toEqual(expect.arrayContaining(['wooli', 'ray-volpe']));
    expect(picks.find((p) => p.artist.id === 'i-hate-models')?.tier ?? 'left out').not.toBe('must-see');
    const onMap = artistsOnMap(catalog.artists, taste, informed).map((a) => a.id);
    expect(onMap).toEqual(expect.arrayContaining(['wooli', 'ray-volpe']));
  });
});
