import { describe, expect, it } from '@jest/globals';
import type { Artist } from '../../../data/models';
import { soundLean } from '../lean';

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
