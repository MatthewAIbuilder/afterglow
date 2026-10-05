import { describe, expect, it } from '@jest/globals';
import { ARTISTS } from '../../../data/mock/artists';
import { CLIPS } from '../../../data/mock/clips';
import { MOCK_TASTE } from '../../../data/mock/tasteProfile';
import type { Clip } from '../../../data/types';
import { computeTaste, WATCH_CAP, WATCH_WEIGHT, WEIGHT } from '../engine';

const clipOf = (artistId: string) => CLIPS.find((c) => c.artistId === artistId)!.id;
const none = { liked: false, saved: false, skipped: false };

describe('taste engine', () => {
  it('starts from the prior when you have not reacted to anything', () => {
    const { taste } = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, {});
    for (const [id, v] of Object.entries(MOCK_TASTE)) expect(taste[id]).toBeCloseTo(v);
  });

  it('raises the match of an artist you like and lowers one you skip', () => {
    const { taste } = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, {
      [clipOf('john-summit')]: { ...none, liked: true },
      [clipOf('sara-landry')]: { ...none, skipped: true },
    });
    expect(taste['john-summit']).toBeGreaterThan(MOCK_TASTE['john-summit']);
    expect(taste['sara-landry']).toBeLessThan(MOCK_TASTE['sara-landry']);
  });

  it('spills a like over to artists with a similar sound, not to unrelated ones', () => {
    const { taste } = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [clipOf('excision')]: { ...none, liked: true } });
    expect(taste.levity).toBeGreaterThan(MOCK_TASTE.levity);
    expect(taste['john-summit']).toBeCloseTo(MOCK_TASTE['john-summit']);
  });

  it('marks artists with no prior and no signal as uninformed', () => {
    const { informed } = computeTaste({}, ARTISTS, CLIPS, { [clipOf('excision')]: { ...none, liked: true } });
    expect(informed.excision).toBe(true);
    expect(informed.levity).toBe(true); // via spill-over
    expect(informed['john-summit']).toBe(false);
  });

  describe('watch behaviour', () => {
    const js = clipOf('john-summit');
    const sl = clipOf('sara-landry');

    it('nudges an artist up when you watch a clip through, less than a like', () => {
      const watched = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [js]: { ...none, watched: 'through' } });
      const liked = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [js]: { ...none, liked: true } });
      expect(watched.taste['john-summit']).toBeGreaterThan(MOCK_TASTE['john-summit']);
      expect(watched.taste['john-summit']).toBeLessThan(liked.taste['john-summit']);
      expect(watched.summary.watched).toBe(1);
    });

    it('treats a replay as stronger than a watch through, and still less than a like', () => {
      const at = (watched: 'through' | 'replayed') =>
        computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [js]: { ...none, watched } }).taste['john-summit'];
      const liked = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [js]: { ...none, liked: true } }).taste['john-summit'];
      expect(at('replayed')).toBeGreaterThan(at('through'));
      expect(at('replayed')).toBeLessThan(liked);
    });

    it('nudges an artist down on a quick swipe, less than a skip', () => {
      const quick = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [sl]: { ...none, watched: 'quick' } });
      const skipped = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [sl]: { ...none, skipped: true } });
      expect(quick.taste['sara-landry']).toBeLessThan(MOCK_TASTE['sara-landry']);
      expect(quick.taste['sara-landry']).toBeGreaterThan(skipped.taste['sara-landry']);
      expect(quick.summary.watched).toBe(0);
    });

    it('lets what you tap win over how you watched', () => {
      const liked = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [sl]: { ...none, liked: true } });
      const likedThenSwiped = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [sl]: { ...none, liked: true, watched: 'quick' } });
      expect(likedThenSwiped.taste['sara-landry']).toBeCloseTo(liked.taste['sara-landry']);

      const skipped = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [sl]: { ...none, skipped: true } });
      const skippedAfterReplay = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, {
        [sl]: { ...none, skipped: true, watched: 'replayed' },
      });
      expect(skippedAfterReplay.taste['sara-landry']).toBeCloseTo(skipped.taste['sara-landry']);
      expect(skippedAfterReplay.summary.watched).toBe(0);
    });

    it('caps passive signal per artist below a single like or skip', () => {
      expect(WATCH_CAP.up).toBeLessThan(WEIGHT.like);
      expect(WATCH_CAP.down).toBeGreaterThan(WEIGHT.skip);
      expect(Math.max(...Object.values(WATCH_WEIGHT))).toBeLessThanOrEqual(WATCH_CAP.up);

      // Twenty clips of one artist, all replayed, still move them less than one like.
      const many: Clip[] = Array.from({ length: 20 }, (_, i) => ({
        id: `m${i}`,
        artistId: 'john-summit',
        festivalId: 'solstice-26',
        title: '',
        durationSec: 45,
        bpm: 126,
      }));
      const clips = [...CLIPS, ...many];
      const binge = computeTaste(
        MOCK_TASTE,
        ARTISTS,
        clips,
        Object.fromEntries(many.map((c) => [c.id, { ...none, watched: 'replayed' as const }])),
      );
      const oneLike = computeTaste(MOCK_TASTE, ARTISTS, clips, { m0: { ...none, liked: true } });
      expect(binge.taste['john-summit']).toBeLessThan(oneLike.taste['john-summit']);

      // Twenty quick swipes still hurt less than one skip.
      const swipes = computeTaste(
        MOCK_TASTE,
        ARTISTS,
        clips,
        Object.fromEntries(many.map((c) => [c.id, { ...none, watched: 'quick' as const }])),
      );
      const oneSkip = computeTaste(MOCK_TASTE, ARTISTS, clips, { m0: { ...none, skipped: true } });
      expect(swipes.taste['john-summit']).toBeGreaterThan(oneSkip.taste['john-summit']);

      // One skip outweighs watching every other clip of theirs.
      const mixed = computeTaste(MOCK_TASTE, ARTISTS, clips, {
        ...Object.fromEntries(many.map((c) => [c.id, { ...none, watched: 'replayed' as const }])),
        [js]: { ...none, skipped: true },
      });
      expect(mixed.taste['john-summit']).toBeLessThan(MOCK_TASTE['john-summit']);
    });

    it('keeps every match within bounds, whatever you watch', () => {
      const all = Object.fromEntries(CLIPS.map((c) => [c.id, { ...none, watched: 'replayed' as const }]));
      const up = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, all);
      const down = computeTaste(
        MOCK_TASTE,
        ARTISTS,
        CLIPS,
        Object.fromEntries(CLIPS.map((c) => [c.id, { ...none, watched: 'quick' as const }])),
      );
      for (const v of [...Object.values(up.taste), ...Object.values(down.taste)]) {
        expect(v).toBeGreaterThanOrEqual(0.05);
        expect(v).toBeLessThanOrEqual(0.99);
      }
    });

    it('ignores watch values it does not recognise (older or damaged saved data)', () => {
      const bad = { [js]: { ...none, watched: 'binged' as unknown as 'through' } };
      const { taste } = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, bad);
      expect(taste['john-summit']).toBeCloseTo(MOCK_TASTE['john-summit']);
      expect(Number.isNaN(taste['john-summit'])).toBe(false);
    });

    it('spills a watch over to similar sounds, like a like does', () => {
      const { taste } = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [clipOf('excision')]: { ...none, watched: 'replayed' } });
      expect(taste.levity).toBeGreaterThan(MOCK_TASTE.levity);
      expect(taste['john-summit']).toBeCloseTo(MOCK_TASTE['john-summit']);
    });
  });

  it('watching artists with the same sound never lifts one you skipped above where the skip put it', () => {
    const ids = ['x', 'a', 'b', 'c', 'd'];
    const artists = ids.map((id) => ({ id, name: id.toUpperCase(), sound: { riddim: 1 } }));
    const clips = ids.map((id) => ({ id: `clip-${id}`, artistId: id, festivalId: 'f', title: 'Set', durationSec: 60, bpm: 140 })) as Clip[];
    const skipped = { 'clip-x': { ...none, skipped: true } };
    const skipOnly = computeTaste({}, artists, clips, skipped).taste.x;
    const watchedOthers = computeTaste({}, artists, clips, {
      ...skipped,
      ...Object.fromEntries(['a', 'b', 'c', 'd'].map((id) => [`clip-${id}`, { ...none, watched: 'replayed' as const }])),
    }).taste;
    expect(watchedOthers.x).toBeLessThanOrEqual(skipOnly);
    expect(watchedOthers.a).toBeGreaterThan(0.5);
  });
});
