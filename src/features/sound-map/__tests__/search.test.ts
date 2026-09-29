import { describe, expect, it } from '@jest/globals';
import type { Artist } from '../../../data/models';
import { extraMatches, mapSearch, soundsMatching } from '../search';

const a = (id: string, name: string, sound: Artist['sound']): Artist => ({ id, name, sound });
const artists = [
  a('wooli', 'WOOLI', { dubstep: 1 }),
  a('illenium', 'ILLENIUM', { 'melodic-bass': 1, dubstep: 0.25 }),
  a('lorde', 'LORDE', { pop: 0.9, indie: 0.3 }),
  a('xx', 'THE XX', { indie: 0.9 }),
  a('dubby', 'DUB CLUB', {}),
];

describe('searching My Sound', () => {
  it('finds sounds by the start of any word, from two letters', () => {
    expect(soundsMatching('dub')).toEqual(['dubstep']);
    expect(soundsMatching('melodic')).toEqual(['melodic-bass']);
    expect(soundsMatching('bass')).toEqual(['melodic-bass']);
    expect(soundsMatching('hip')).toEqual(['hip-hop']);
    expect(soundsMatching('hiphop')).toEqual(['hip-hop']);
    expect(soundsMatching('d')).toEqual([]);
  });

  it('lights up everyone matching by name or by sound', () => {
    const dub = mapSearch(artists, 'dub')!;
    expect(dub.sounds).toEqual(['dubstep']);
    // WOOLI carries dubstep, DUB CLUB matches by name; ILLENIUM is only a little dubstep.
    expect([...dub.ids].sort()).toEqual(['dubby', 'wooli']);
    expect([...mapSearch(artists, 'indie')!.ids]).toEqual(['xx']);
    expect([...mapSearch(artists, 'lor')!.ids]).toEqual(['lorde']);
    expect(mapSearch(artists, '  ')).toBeUndefined();
  });

  it('brings matches that are not on the map yet onto it, best first', () => {
    const search = mapSearch(artists, 'dub')!;
    const extra = extraMatches(artists, [artists[0]], search, { dubby: 0.4 });
    expect(extra.map((x) => x.id)).toEqual(['dubby']);
    expect(extraMatches(artists, [], search, {}, 1)).toHaveLength(1);
  });
});
