import { describe, expect, it } from '@jest/globals';
import type { Artist } from '../../../data/models';
import { soundsLike } from '../tune';
import { soundSimilarity } from '../../taste/similarity';

const a = (id: string, sound: Artist['sound']): Artist => ({ id, name: id.toUpperCase(), sound });
const newcomer = a('newcomer', { 'melodic-bass': 1 });
const artists = [
  newcomer,
  a('illenium', { 'melodic-bass': 1 }),
  a('san-holo', { 'melodic-bass': 0.8, house: 0.3 }),
  a('seven-lions', { 'melodic-bass': 0.9 }),
  a('excision', { dubstep: 1 }),
];
const ids = (list: Artist[]) => list.map((x) => x.id);

describe('who a new artist sounds like', () => {
  it('names up to two artists you like, closest first', () => {
    const liked = (x: Artist) => ['illenium', 'san-holo', 'seven-lions', 'excision'].includes(x.id);
    const found = ids(soundsLike(newcomer, artists, liked, soundSimilarity));
    expect(found).toHaveLength(2);
    expect(found[0]).toBe('illenium');
    expect(found).not.toContain('excision');
  });

  it('only uses artists you like, and only close sounds', () => {
    expect(ids(soundsLike(newcomer, artists, (x) => x.id === 'excision', soundSimilarity))).toEqual([]);
    expect(ids(soundsLike(newcomer, artists, (x) => x.id === 'san-holo', soundSimilarity))).toEqual(['san-holo']);
    expect(soundsLike(newcomer, artists, () => false, soundSimilarity)).toEqual([]);
  });

  it('says nothing for an artist whose sound is unknown', () => {
    expect(soundsLike(a('mystery', {}), artists, () => true, soundSimilarity)).toEqual([]);
  });
});
