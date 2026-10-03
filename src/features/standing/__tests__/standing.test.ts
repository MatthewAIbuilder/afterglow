import { describe, expect, it } from '@jest/globals';
import { standingFromDocs } from '../../social/firebase/mapping';
import { captionsOf, founderCaption, ringOf, showsGlow, standingA11y } from '../standing';

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

  it('reads Afterglow Plus, which turns the edge glow off', () => {
    expect(standingFromDocs(undefined, undefined, { active: true })).toEqual({ plus: true });
    expect(standingFromDocs(undefined, undefined, { active: true, until: '2020-01-01T00:00:00Z' })).toEqual({});
    expect(standingFromDocs(undefined, undefined, { active: false })).toEqual({});
    // Glow levels: whole numbers from 1 to 999 only.
    expect(standingFromDocs(undefined, undefined, undefined, { level: 4 })).toEqual({ level: 4 });
    expect(standingFromDocs(undefined, undefined, undefined, { level: 0 })).toEqual({});
    expect(standingFromDocs(undefined, undefined, undefined, { level: 2.5 })).toEqual({});
    expect(standingFromDocs(undefined, undefined, undefined, { level: '4' })).toEqual({});
    expect([showsGlow(undefined), showsGlow({ founder: 3 }), showsGlow({ plus: true })]).toEqual([true, true, false]);
  });
});
