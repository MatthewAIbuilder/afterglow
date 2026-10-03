import { describe, expect, it } from '@jest/globals';
import { GUESS_TRUST, soundSimilarity } from '../../features/taste/similarity';
import type { Artist, CatalogSnapshot, Festival } from '../models';
import { soundFrom, withGuessedSounds } from '../soundGuess';

const artist = (id: string, sound: Artist['sound'] = {}): Artist => ({ id, name: id.toUpperCase(), sound });
const festival = (id: string, lineup: string[], extra: Partial<Festival> = {}): Festival =>
  ({ id, name: id, dates: 'x', location: 'x', lineup, days: [], stages: [], ...extra }) as Festival;
const bass = (id: string) => artist(id, { dubstep: 1, riddim: 0.4 });
const house = (id: string) => artist(id, { house: 1 });

describe('guessed sounds', () => {
  it('leaves a catalogue where everyone has a sound exactly as it was', () => {
    const snap: CatalogSnapshot = { artists: [bass('a'), house('b')], festivals: [festival('f', ['a', 'b'])], clips: [] };
    expect(withGuessedSounds(snap)).toBe(snap);
  });

  it('guesses from the festivals someone plays, and marks it as a guess', () => {
    const snap: CatalogSnapshot = {
      artists: [bass('a'), bass('b'), bass('c'), bass('d'), bass('e'), artist('new')],
      festivals: [festival('bassfest', ['a', 'b', 'c', 'd', 'e', 'new'])],
      clips: [],
    };
    const out = withGuessedSounds(snap);
    const guessed = out.artists.find((a) => a.id === 'new')!;
    expect(guessed.soundGuessed).toBe(true);
    expect(guessed.sound.dubstep).toBe(1);
    expect(guessed.sound.riddim).toBeGreaterThan(0);
    // Artists with their own sound are untouched.
    expect(out.artists.find((a) => a.id === 'a')).toBe(snap.artists[0]);
  });

  it('needs enough artists of known sound on a lineup', () => {
    const snap: CatalogSnapshot = { artists: [bass('a'), bass('b'), artist('new')], festivals: [festival('small', ['a', 'b', 'new'])], clips: [] };
    expect(withGuessedSounds(snap)).toBe(snap);
  });

  it('listens to the day they play more than the whole lineup', () => {
    const snap: CatalogSnapshot = {
      artists: [bass('a'), bass('b'), bass('c'), house('d'), house('e'), house('f'), house('g'), artist('new')],
      festivals: [
        festival('mixed', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'new'], {
          days: ['Friday', 'Saturday'],
          artistDays: { a: ['Friday'], b: ['Friday'], c: ['Friday'], d: ['Saturday'], e: ['Saturday'], f: ['Saturday'], g: ['Saturday'], new: ['Friday'] },
        }),
      ],
      clips: [],
    };
    const guessed = withGuessedSounds(snap).artists.find((a) => a.id === 'new')!;
    // The lineup leans house, but their Friday is all bass.
    expect(guessed.sound.dubstep).toBe(1);
  });

  it('follows who they share bills with, and passes it on a second round', () => {
    const snap: CatalogSnapshot = {
      artists: [house('a'), artist('new'), artist('newer')],
      festivals: [],
      clips: [],
      similarities: [
        { artistId: 'new', otherId: 'a', score: 0.6 },
        { artistId: 'newer', otherId: 'new', score: 0.7 },
      ],
    };
    const out = withGuessedSounds(snap);
    expect(out.artists.find((a) => a.id === 'new')?.sound).toEqual({ house: 1 });
    expect(out.artists.find((a) => a.id === 'newer')?.sound).toEqual({ house: 1 });
    // Too little to go on: no guess.
    const weak = withGuessedSounds({ ...snap, similarities: [{ artistId: 'new', otherId: 'a', score: 0.2 }] });
    expect(weak.artists.find((a) => a.id === 'new')?.sound).toEqual({});
  });

  it('keeps the strongest few sounds, the top at 1', () => {
    const s = soundFrom({ dubstep: 5, riddim: 3, house: 2, techno: 0.2, trap: 0.1 })!;
    expect(s.dubstep).toBe(1);
    expect(Object.keys(s).length).toBeLessThanOrEqual(3);
    expect(s.techno).toBeUndefined();
    expect(soundFrom({})).toBeUndefined();
  });

  it('trusts a guessed sound a little less when comparing artists', () => {
    const a = bass('a');
    expect(soundSimilarity(a, bass('b'))).toBeCloseTo(1);
    expect(soundSimilarity(a, { ...bass('b'), soundGuessed: true })).toBeCloseTo(GUESS_TRUST);
  });
});
