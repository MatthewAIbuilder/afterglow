import { describe, expect, it } from '@jest/globals';
import type { Artist } from '../../../data/models';
import type { ArtistSignals } from '../../taste/why';
import { favouritesOf, pickWhy, whyText } from '../reasons';

const artist = (id: string, name: string, sound: Artist['sound'] = { 'melodic-bass': 1 }): Artist => ({ id, name, sound }) as Artist;
const illenium = artist('illenium', 'ILLENIUM');
const seven = artist('seven-lions', 'Seven Lions');
const excision = artist('excision', 'Excision', { dubstep: 1 });
const none: ArtistSignals = { likes: 0, saves: 0, skips: 0, watched: 0 };
// Same lead sound: alike; otherwise not.
const similarity = (a: Artist, b: Artist) => (Object.keys(a.sound)[0] === Object.keys(b.sound)[0] ? 0.8 : 0.1);
const pick = (a: Artist, over: Partial<{ match: number; pinned: boolean; known: boolean }> = {}) => ({ artist: a, match: 0.8, pinned: false, known: true, ...over });
const why = (p: ReturnType<typeof pick>, s: Partial<ArtistSignals> = {}, favs: Artist[] = []) => whyText(pickWhy(p, { ...none, ...s }, favs, similarity));

describe('why a pick is on your list', () => {
  it('your own signals first, in plain words', () => {
    expect(why(pick(seven, { match: 0.5, pinned: true }))).toBe('You starred this one.');
    expect(why(pick(seven), { rating: 'love' })).toBe('You love them.');
    expect(why(pick(seven), { rating: 'like', likes: 3 })).toBe('You like them.');
    expect(why(pick(seven), { likes: 1 })).toBe('You liked one of their sets.');
    expect(why(pick(seven), { likes: 2, saves: 1 })).toBe('You liked and saved their sets.');
    expect(why(pick(seven), { saves: 3 })).toBe('You saved 3 of their sets.');
    expect(why(pick(seven), { watched: 2 })).toBe('You watched 2 of their sets all the way through.');
    expect(why(pick(seven), { library: ['Spotify'] })).toBe('In your Spotify library.');
  });

  it('then a favourite they sound like, then your sound, then a first guess', () => {
    expect(why(pick(seven), {}, [illenium, excision])).toBe('Sounds like ILLENIUM, one of your favourites.');
    // Never "sounds like" themselves, or someone who doesn't.
    expect(why(pick(illenium), {}, [illenium, excision])).toBe('Right in your sound: melodic bass.');
    expect(why(pick(seven, { known: false }))).toBe('A first guess. Rate them to sharpen it.');
    // A star on a top match isn't the reason: the match is.
    expect(why(pick(seven, { match: 0.95, pinned: true }), { rating: 'love' })).toBe('You love them.');
  });

  it('favourites are the artists you love, like, or liked and saved, best match first', () => {
    const favs = favouritesOf([illenium, seven, excision], { illenium: 'like', excision: 'pass' }, new Set(['seven-lions', 'excision']), { illenium: 0.7, 'seven-lions': 0.9, excision: 0.95 });
    expect(favs.map((a) => a.id)).toEqual(['seven-lions', 'illenium']);
  });
});
