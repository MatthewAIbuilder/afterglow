import { describe, expect, it } from '@jest/globals';
import { cardFrom, cardLink } from '../cards';

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
