import { describe, expect, it } from '@jest/globals';
import type { Artist } from '../../../data/models';
import { pickCandidates, pickDoneLabel } from '../quickPick';

const artists: Record<string, Artist> = Object.fromEntries(['a', 'b', 'c', 'x', 'y', 'z'].map((id) => [id, { id, name: id.toUpperCase(), sound: {} }]));

describe('pick the artists you know', () => {
  it('takes turns between lineups in billing order, without repeats or anyone rated', () => {
    const got = pickCandidates([{ lineup: ['a', 'b', 'c'] }, { lineup: ['x', 'a', 'y', 'z'] }], (id) => artists[id], { y: 'pass' });
    expect(got.map((a) => a.id)).toEqual(['a', 'x', 'b', 'c', 'z']);
    expect(pickCandidates([{ lineup: ['ghost', 'a'] }], (id) => artists[id], {}).map((a) => a.id)).toEqual(['a']);
  });

  it('puts the best known first: festivals they play, then a known sound and a photo', () => {
    const tagged: Record<string, Artist> = { ...artists, c: { ...artists.c, sound: { dubstep: 1 } }, b: { ...artists.b, imageUrl: 'https://x.example/b.jpg' } };
    const plays = (id: string) => (id === 'z' ? 3 : 1);
    const got = pickCandidates([{ lineup: ['a', 'b', 'c', 'z'] }], (id) => tagged[id], {}, plays);
    expect(got.map((a) => a.id)).toEqual(['z', 'c', 'b', 'a']);
  });

  it('says what the button does', () => {
    expect(pickDoneLabel(0)).toBe('Skip for now');
    expect(pickDoneLabel(3)).toBe('Done · 3 picked');
  });
});
