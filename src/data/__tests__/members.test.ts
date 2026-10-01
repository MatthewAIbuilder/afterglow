import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../bundled';
import { parseCatalogFile } from '../file';
import { memberPlan } from '../import/photos';
import { anyPhoto, b2bParts, photoCredit, withMembers } from '../members';
import { buildCatalog } from '../merge';
import type { Artist, CatalogSnapshot } from '../models';

const art = (id: string, name: string, more: Partial<Artist> = {}): Artist => ({ id, name, sound: {}, ...more });
const snap = (artists: Artist[]): CatalogSnapshot => ({ artists, festivals: [], clips: [] });
const SUB = 'https://cdn.example/subtronics.jpg';
const CRANK = 'https://cdn.example/crankdat.jpg';

describe('b2b artists', () => {
  it('splits a b2b name into its artists', () => {
    expect(b2bParts('SUBTRONICS B2B CRANKDAT')).toEqual(['SUBTRONICS', 'CRANKDAT']);
    expect(b2bParts('Caspa b2b The Widdler')).toEqual(['Caspa', 'The Widdler']);
    expect(b2bParts('A B3B B B3B C')).toEqual(['A', 'B', 'C']);
    expect(b2bParts('WITCHING HOUR (JEANIE B2B VAMPA)')).toEqual(['JEANIE', 'VAMPA']);
    expect(b2bParts('WALKER & ROYCE')).toBeUndefined();
    expect(b2bParts('LEVITY')).toBeUndefined();
    expect(b2bParts('B2B')).toBeUndefined();
    expect(b2bParts('A B2B B B2B C B2B D B2B E')).toBeUndefined();
  });

  it("gives a b2b its artists' photos: from Afterglow's artists, else the member photos", () => {
    const before = snap([
      art('subtronics', 'Subtronics', { imageUrl: SUB, imageCredit: 'Deezer', color: '#8E6BFF' }),
      art('sub-crank', 'SUBTRONICS B2B CRANKDAT'),
      art('a-b', 'A B2B B'),
    ]);
    const after = withMembers(before, { crankdat: CRANK }, 'Deezer');
    expect(after.artists[1].members).toEqual([
      { name: 'Subtronics', id: 'subtronics', imageUrl: SUB, imageCredit: 'Deezer', color: '#8E6BFF' },
      { name: 'CRANKDAT', imageUrl: CRANK, imageCredit: 'Deezer' },
    ]);
    // No photo for anyone: left as it was, keeping its monogram.
    expect(after.artists[2].members).toBeUndefined();
    expect(anyPhoto(after.artists[1])).toBe(SUB);
    expect(photoCredit(after.artists[1])).toBe('Deezer');
  });

  it("leaves a b2b with a photo of its own alone, and changes nothing when there's nothing to add", () => {
    const own = snap([art('subtronics', 'SUBTRONICS', { imageUrl: SUB }), art('sub-crank', 'SUBTRONICS B2B CRANKDAT', { imageUrl: 'https://cdn.example/b2b.jpg' })]);
    expect(withMembers(own, { CRANKDAT: CRANK })).toBe(own);
    const none = snap([art('sub-crank', 'SUBTRONICS B2B CRANKDAT')]);
    expect(withMembers(none)).toBe(none);
  });

  it('reads member photos from a catalogue file, https only', () => {
    const parsed = parseCatalogFile({ version: 1, memberPhotos: { CRANKDAT: CRANK, VAMPA: 'http://insecure.example/v.jpg', '': CRANK } });
    expect(parsed.memberPhotos).toEqual({ CRANKDAT: CRANK });
  });

  it('shows both faces on the real catalogue once the nightly photos are in', () => {
    const file = parseCatalogFile({ version: 1, photos: { subtronics: SUB }, memberPhotos: { CRANKDAT: CRANK }, photoCredit: 'Deezer' });
    const built = buildCatalog(BUILT_IN.snapshot, file);
    expect(built.problems).toEqual([]);
    const b2b = built.catalog.artists.find((a) => a.id === 'subtronics-b2b-crankdat');
    expect(b2b?.members?.map((m) => [m.name, m.imageUrl])).toEqual([
      ['SUBTRONICS', SUB],
      ['CRANKDAT', CRANK],
    ]);
    expect(b2b?.members?.[0].id).toBe('subtronics');
  });

  it('plans member photo lookups: only artists not on Afterglow, once each, reusing last night', () => {
    const plan = memberPlan(
      [
        art('subtronics', 'SUBTRONICS'),
        art('sub-crank', 'SUBTRONICS B2B CRANKDAT'),
        art('crank-x', 'Crankdat b2b Excision'),
        art('own', 'A B2B B', { imageUrl: 'https://cdn.example/ab.jpg' }),
        art('jv', 'WITCHING HOUR (JEANIE B2B VAMPA)'),
      ],
      { Crankdat: CRANK },
      2,
    );
    expect(plan.reuse).toEqual({ CRANKDAT: CRANK });
    expect(plan.lookUp).toEqual(['Excision', 'JEANIE']);
  });
});
