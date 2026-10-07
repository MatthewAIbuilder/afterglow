import { describe, expect, it } from '@jest/globals';
import { artistLook } from '../artistLook';
import { collection } from '../collection';

const artists = [
  { id: 'rezz', name: 'REZZ', sound: {} },
  { id: 'subtronics', name: 'SUBTRONICS', sound: {} },
  { id: 'some-dj', name: 'Some DJ', sound: { house: 1 } },
];
const base = {
  kinds: new Set<'seedling' | 'plur'>(['seedling', 'plur']),
  catalogArtists: artists,
  lookOf: (id: string) => {
    const a = artists.find((x) => x.id === id);
    return a ? artistLook(a as never) : undefined;
  },
  stickers: new Set(['tent', 'discoball']),
  kandi: [{ beads: 'galaxy' as const, charm: 'alien' as const }, { beads: 'galaxy' as const }],
};

describe('your collection', () => {
  it('counts what you have of every set', () => {
    const book = collection({
      ...base,
      artists: [
        { artistId: 'rezz', videos: 2, tier: 0, firstAt: 0, lastAt: 0, shiny: true },
        { artistId: 'some-dj', videos: 1, tier: 0, firstAt: 0, lastAt: 0 },
      ],
    });
    const of = (id: string) => book.sets.find((s) => s.id === id)!;
    expect(of('kinds').have).toBe(2);
    expect(of('kinds').total).toBe(8);
    // Only the hand-made ones whose artists are on Afterglow.
    expect(of('signatures')).toMatchObject({ have: 1, total: 2 });
    // A sound artist's collectible fills in its sound creature.
    expect(of('sounds').have).toBe(1);
    expect(of('stickers').have).toBe(2);
    expect(of('beads').have).toBe(1);
    expect(of('charms').have).toBe(1);
    expect(book.shiny).toBe(1);
    expect(book.have).toBe(book.sets.reduce((n, s) => n + s.have, 0));
  });
});
