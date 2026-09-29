import { describe, expect, it } from '@jest/globals';
import type { Artist } from '../../../data/models';
import { artistMix, soundLean, tasteMix, toShares } from '../lean';

const a = (id: string, sound: Artist['sound']): Artist => ({ id, name: id, sound });
const artists = [
  a('m1', { 'melodic-bass': 1 }),
  a('m2', { 'melodic-bass': 0.8, dubstep: 0.4 }),
  a('d1', { dubstep: 1 }),
  a('h1', { house: 1 }),
];
const all = { m1: true, m2: true, d1: true, h1: true };

describe('which sounds your taste leans towards', () => {
  it('names the strongest pull, and a second one when it is big enough', () => {
    expect(soundLean(artists, { m1: 0.9, m2: 0.8, d1: 0.8, h1: 0.3 }, all)).toEqual(['melodic-bass', 'dubstep']);
    expect(soundLean(artists, { m1: 0.95, m2: 0.9, d1: 0.55, h1: 0.2 }, all)).toEqual(['melodic-bass']);
  });

  it('ignores artists at or below neutral, and ones the engine knows nothing about', () => {
    expect(soundLean(artists, { h1: 0.9, m1: 0.5 }, all)).toEqual(['house']);
    expect(soundLean(artists, { h1: 0.9, d1: 0.9 }, { d1: true })).toEqual(['dubstep']);
    expect(soundLean(artists, { m1: 0.4 }, all)).toEqual([]);
    expect(soundLean([], {}, {})).toEqual([]);
  });
});

describe('sound mixes', () => {
  it('shares weights out as whole percentages that add up to 100, largest first', () => {
    expect(toShares({ 'melodic-bass': 1, dubstep: 0.25 }).map((s) => [s.tag, s.percent])).toEqual([
      ['melodic-bass', 80],
      ['dubstep', 20],
    ]);
    const thirds = toShares({ house: 1, techno: 1, trap: 1 });
    expect(thirds.map((s) => s.percent).reduce((x, y) => x + y, 0)).toBe(100);
    expect(thirds.map((s) => s.tag)).toEqual(['trap', 'techno', 'house']);
    expect(thirds.map((s) => s.percent)).toEqual([34, 33, 33]);
  });

  it('leaves out sounds that round to nothing, and has nothing for no sound', () => {
    expect(toShares({ dubstep: 1, house: 0.001 }).map((s) => s.tag)).toEqual(['dubstep']);
    expect(toShares({})).toEqual([]);
    expect(artistMix(a('new', {}))).toEqual([]);
  });

  it('mixes your taste from the same pull as your lean', () => {
    const mix = tasteMix(artists, { m1: 0.9, m2: 0.8, d1: 0.7, h1: 0.3 }, all);
    expect(mix[0].tag).toBe(soundLean(artists, { m1: 0.9, m2: 0.8, d1: 0.7, h1: 0.3 }, all)[0]);
    expect(mix.reduce((x, s) => x + s.percent, 0)).toBe(100);
    expect(mix.some((s) => s.tag === 'house')).toBe(false);
    expect(tasteMix(artists, {}, all)).toEqual([]);
  });
});
