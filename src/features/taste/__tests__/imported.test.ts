import { describe, expect, it } from '@jest/globals';
import { ARTISTS } from '../../../data/mock/artists';
import { CLIPS } from '../../../data/mock/clips';
import { MOCK_TASTE } from '../../../data/mock/tasteProfile';
import { computeTaste, IMPORT_CAP, IMPORT_SOUND_CAP, type ImportedTaste } from '../engine';

/**
 * The imported music layer: a connected library gives a new listener a head
 * start, stays below what they do in Afterglow, and is reported apart from it.
 */
const clipOf = (artistId: string) => CLIPS.find((c) => c.artistId === artistId)!.id;
const none = { liked: false, saved: false, skipped: false };
// A brand-new listener: no starting prior, so every match starts as a 50% guess.
const fresh = {};
const run = (imported?: ImportedTaste, reactions = {}, ratings = {}) =>
  computeTaste(fresh, ARTISTS, CLIPS, reactions, undefined, ratings, imported);
const lib = (artists: Record<string, number>, sounds: ImportedTaste['sounds'] = []): ImportedTaste => ({ artists, sounds });

describe('imported music in the taste engine', () => {
  it('no library changes nothing', () => {
    const without = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, {});
    const withEmpty = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, {}, undefined, {}, lib({}));
    expect(withEmpty.taste).toEqual(without.taste);
    expect(withEmpty.informed).toEqual(without.informed);
    expect(withEmpty.imported).toEqual({});
  });

  it('lifts artists from your library and places them on the map (informed)', () => {
    const { taste, informed, imported } = run(lib({ subtronics: 1 }));
    expect(taste.subtronics).toBeGreaterThan(0.5);
    expect(informed.subtronics).toBe(true);
    // Spill-over to a similar sound, nothing for an unrelated one.
    expect(taste.levity).toBeGreaterThan(0.5);
    expect(informed['john-summit']).toBe(false);
    expect(taste['john-summit']).toBe(0.5);
    // Kept apart from behaviour, so it can be tuned on its own.
    expect(imported.subtronics).toBeGreaterThan(0);
    expect(imported['john-summit']).toBeUndefined();
  });

  it('a stronger library signal lifts more: one saved song is weak, a followed favourite is strong', () => {
    const weak = run(lib({ subtronics: 0.15 })).taste.subtronics;
    const strong = run(lib({ subtronics: 1 })).taste.subtronics;
    expect(weak).toBeGreaterThan(0.5);
    expect(strong).toBeGreaterThan(weak);
  });

  it('is conservative: a whole library’s worth is less than a single like in Afterglow', () => {
    const imported = run(lib({ 'john-summit': 1 })).taste['john-summit'];
    const liked = run(undefined, { [clipOf('john-summit')]: { ...none, liked: true } }).taste['john-summit'];
    expect(imported).toBeLessThan(liked);
  });

  it('one skip in Afterglow outweighs the library', () => {
    const { taste } = run(lib({ 'john-summit': 1 }), { [clipOf('john-summit')]: { ...none, skipped: true } });
    expect(taste['john-summit']).toBeLessThan(0.5);
  });

  it('likes, saves and ratings still move the match after an import, and the library counts half once you’ve reacted', () => {
    const base = run(lib({ 'john-summit': 1 })).taste['john-summit'];
    const liked = run(lib({ 'john-summit': 1 }), { [clipOf('john-summit')]: { ...none, liked: true } });
    expect(liked.taste['john-summit']).toBeGreaterThan(base);
    expect(liked.imported['john-summit']).toBeCloseTo(IMPORT_CAP / 2);
    expect(liked.summary).toEqual({ likes: 1, saves: 0, skips: 0, watched: 0 });
    // A rating is taken at its word, library or not.
    expect(run(lib({ 'john-summit': 1 }), {}, { 'john-summit': 'pass' }).taste['john-summit']).toBeLessThanOrEqual(0.3);
  });

  it('never exceeds its cap, however much of the library points at one artist', () => {
    const { imported } = run(lib({ subtronics: 1, levity: 1, excision: 1 }, Array(50).fill({ sound: { dubstep: 1, riddim: 1 }, strength: 1 })));
    for (const v of Object.values(imported)) expect(v).toBeLessThanOrEqual(IMPORT_CAP + 1e-9);
  });

  it('library artists Afterglow doesn’t have count through their sound only, capped', () => {
    const { taste, imported, informed } = run(lib({}, Array(20).fill({ sound: { techno: 1 }, strength: 1 })));
    expect(taste['sara-landry']).toBeGreaterThan(0.5);
    expect(imported['sara-landry']).toBeCloseTo(IMPORT_SOUND_CAP);
    expect(informed.illenium).toBe(false);
  });

  it('ignores library artists that aren’t in the catalogue', () => {
    expect(run(lib({ 'not-an-artist': 1 })).imported).toEqual({});
  });
});
