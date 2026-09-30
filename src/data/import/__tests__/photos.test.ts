import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../../bundled';
import { parseCatalogFile } from '../../file';
import { applyPhotos, buildCatalog } from '../../merge';
import { deezerSearchUrl, photoPlan, pickDeezerPhoto } from '../photos';

// A Deezer search answer, shaped like the real one.
const pic = (hash: string) => `https://cdn-images.dzcdn.net/images/artist/${hash}/500x500-000000-80-0-0.jpg`;
const H1 = 'a'.repeat(32);
const H2 = 'b'.repeat(32);
const answer = {
  data: [
    { id: 1, name: 'Subtronics Tribute', picture_big: pic('c'.repeat(32)), nb_fan: 900000 },
    { id: 2, name: 'SUBTRONICS', picture_big: pic(H1), nb_fan: 120000 },
    { id: 3, name: 'Subtronics', picture_big: pic(H2), nb_fan: 40 },
    { id: 4, name: 'Subtronics', picture_big: 'https://e-cdns-images.dzcdn.net/images/artist//500x500-000000-80-0-0.jpg', nb_fan: 9999999 },
  ],
  total: 4,
};

describe('artist photos from Deezer', () => {
  it('searches by name', () => {
    expect(deezerSearchUrl('RÜFÜS DU SOL')).toBe('https://api.deezer.com/search/artist?q=R%C3%9CF%C3%9CS%20DU%20SOL&limit=10');
  });

  it('takes only an exact name match, the most followed, never the blank placeholder', () => {
    expect(pickDeezerPhoto('SUBTRONICS', answer)).toBe(pic(H1));
    expect(pickDeezerPhoto('subtronics', { data: [answer.data[3]] })).toBeUndefined();
    expect(pickDeezerPhoto('Excision', answer)).toBeUndefined();
    expect(pickDeezerPhoto('SUBTRONICS', { error: { type: 'QuotaException' } })).toBeUndefined();
    expect(pickDeezerPhoto('', answer)).toBeUndefined();
  });

  it('reuses published photos and looks up the rest, skipping artists with their own', () => {
    const plan = photoPlan(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B', imageUrl: 'https://own.example/b.jpg' },
        { id: 'c', name: 'C' },
        { id: 'd', name: 'D' },
      ],
      { a: pic(H1), b: pic(H2) },
      1,
    );
    expect(plan).toEqual({ reuse: { a: pic(H1) }, lookUp: [{ id: 'c', name: 'C' }] });
  });
});

describe('photos in the catalogue file', () => {
  it('reads a photo list and gives it to artists without their own photo', () => {
    const file = parseCatalogFile({
      version: 1,
      artists: [],
      festivals: [],
      clips: [],
      photos: { subtronics: pic(H1), levity: 'http://not-secure.example/x.jpg', 'bad id!': pic(H2) },
      photoCredit: 'Deezer',
    });
    expect(file.photos).toEqual({ subtronics: pic(H1) });
    expect(file.problems).toEqual(['2 photos were left out: each needs an artist id and an https link.']);
    const built = buildCatalog(BUILT_IN.snapshot, file);
    expect(built.catalog.artist('subtronics')).toMatchObject({ imageUrl: pic(H1), imageCredit: 'Deezer' });
    expect(built.catalog.artist('levity')?.imageUrl).toBeUndefined();
  });

  it('a photo set in the catalogue always wins', () => {
    const snap = { artists: [{ id: 'x', name: 'X', imageUrl: 'https://own.example/x.jpg', sound: {} }], festivals: [], clips: [] };
    expect(applyPhotos(snap, { x: pic(H1) }, 'Deezer')).toBe(snap);
    expect(applyPhotos(snap, undefined)).toBe(snap);
  });

  it('gives artists showing a photo the colour taken from it', () => {
    const file = parseCatalogFile({ version: 1, artists: [], festivals: [], clips: [], photos: { subtronics: pic(H1) }, colors: { subtronics: '#e04090', levity: '#00ff00', bad: 'pink' } });
    expect(file.colors).toEqual({ subtronics: '#E04090', levity: '#00FF00' });
    const built = buildCatalog(BUILT_IN.snapshot, file);
    expect(built.problems).toEqual([]);
    expect(built.catalog.artist('subtronics')?.color).toBe('#E04090');
    // No photo showing, so no colour from one.
    expect(built.catalog.artist('levity')?.color).toBeUndefined();
  });
});
