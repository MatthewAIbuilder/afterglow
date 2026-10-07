import { describe, expect, it } from '@jest/globals';
import { cardFrom, cardLink } from '../cards';
import { artistLook, shinyFor, shinyLook } from '../artistLook';
import { cleanPublicGarden, gardenKey, publicGarden } from '../publicGarden';

describe('shared collectible cards', () => {
  it('a link carries the card as its owner has it, and reads back', () => {
    const c = { artistId: 'subtronics', handle: 'matt.raves', tier: 3 as const, videos: 12, shiny: true };
    const link = cardLink(c);
    expect(link).toBe('https://afterglowmusic.app/card/subtronics?h=matt.raves&t=3&v=12&s=1');
    const q = Object.fromEntries(new URL(link).searchParams.entries());
    expect(cardFrom({ id: 'subtronics', ...q })).toEqual(c);
  });
  it('tidies up anything odd', () => {
    expect(cardFrom({ id: '../x' })).toBeUndefined();
    expect(cardFrom({ id: 'rezz', h: 'Not OK!', t: '9', v: '-3' })).toEqual({ artistId: 'rezz', handle: '', tier: 0, videos: 0, shiny: false });
  });
});

describe('shiny collectibles', () => {
  it('about one in twelve, decided by account and artist, the same every time', () => {
    const ids = Array.from({ length: 1200 }, (_, i) => `artist-${i}`);
    const shiny = ids.filter((id) => shinyFor('uid-abc', id)).length;
    expect(shiny).toBeGreaterThan(60);
    expect(shiny).toBeLessThan(150);
    expect(ids.map((id) => shinyFor('uid-abc', id))).toEqual(ids.map((id) => shinyFor('uid-abc', id)));
    // Someone else's luck is their own.
    expect(ids.filter((id) => shinyFor('uid-xyz', id))).not.toEqual(ids.filter((id) => shinyFor('uid-abc', id)));
  });
  it('a shiny one is the same creature in other colours', () => {
    const look = artistLook({ id: 'rezz', name: 'REZZ', sound: {} } as never);
    const shiny = shinyLook(look);
    expect(shiny.creature).toBe(look.creature);
    expect(shiny.palette.mid).not.toBe(look.palette.mid);
    expect(shiny.palette.mid).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('shows on a garden visitors see', () => {
    const list = publicGarden([], [{ artistId: 'rezz', videos: 2, tier: 0, firstAt: 0, lastAt: 0, shiny: true }], () => 'REZZ');
    expect(list).toEqual([{ k: 'a', artistId: 'rezz', name: 'REZZ', tier: 0, shiny: true }]);
    expect(cleanPublicGarden(list)).toEqual(list);
    expect(gardenKey(list)).not.toBe(gardenKey([{ k: 'a', artistId: 'rezz', name: 'REZZ', tier: 0 }]));
  });
});
