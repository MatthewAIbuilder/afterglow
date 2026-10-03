import { describe, expect, it } from '@jest/globals';
import { standingFromDocs } from '../../social/firebase/mapping';
import { captionsOf, founderCaption, ringOf, standingA11y } from '../standing';

describe('standing', () => {
  it('reads founders and flairs safely', () => {
    expect(standingFromDocs({ number: 7 }, undefined)).toEqual({ founder: 7 });
    expect(standingFromDocs({ number: 101 }, { kind: 'artist', caption: ' Artist ' })).toEqual({ flair: { kind: 'artist', caption: 'Artist' } });
    expect(standingFromDocs({ number: '3' }, { kind: 'king', caption: 'x' })).toEqual({});
  });

  it('draws the flair over founder, and captions both', () => {
    expect(ringOf({ founder: 7 })).toBe('founder');
    expect(ringOf({ founder: 7, flair: { kind: 'artist', caption: 'Artist' } })).toBe('artist');
    expect(ringOf({})).toBeUndefined();
    expect(captionsOf({ founder: 7, flair: { kind: 'team', caption: 'Afterglow team' } }).map((c) => c.text)).toEqual(['Afterglow team', founderCaption(7)]);
    expect(founderCaption(23)).toBe('One of the first 100 on Afterglow · #23');
    expect(standingA11y({ founder: 23 })).toBe('One of the first 100 on Afterglow, number 23');
  });
});
