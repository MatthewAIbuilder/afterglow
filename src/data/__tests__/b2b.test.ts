import { describe, expect, it } from '@jest/globals';
import { b2bIndex, partnersInTitle, partnersOf, playersOf, titleWithoutPartners, together, withPartners } from '../b2b';
import bundled from '../../../catalogue/afterglow.json';
import { createCatalog } from '../catalog';
import { fold } from '../import/edmtrain';
import { b2bParts } from '../members';
import type { Artist, CatalogSnapshot, Clip } from '../models';
import { computeTaste } from '../../features/taste/engine';
import { scoreClips } from '../../features/recommend/feed';

const artists: Artist[] = [
  { id: 'layz', name: 'LAYZ', sound: { dubstep: 1 } },
  { id: 'kompany', name: 'KOMPANY', sound: { dubstep: 1 } },
  { id: 'subtronics', name: 'SUBTRONICS', sound: { dubstep: 1 }, imageUrl: 'https://x.test/sub.jpg' },
  { id: 'crankdat', name: 'CRANKDAT', sound: { dubstep: 1 } },
  { id: 'subtronics-b2b-crankdat', name: 'SUBTRONICS B2B CRANKDAT', sound: { dubstep: 1 } },
  { id: 'john-summit', name: 'JOHN SUMMIT', sound: { house: 1 } },
  { id: 'dj-snake', name: 'DJ SNAKE', sound: { trap: 1 } },
];
const clip = (id: string, artistId: string, title: string, extra: Partial<Clip> = {}): Clip => ({ id, artistId, festivalId: 'f1', title, durationSec: 60, bpm: 140, ...extra });
const clips: Clip[] = [
  clip('c-layz', 'layz', 'B2B KOMPANY FORBIDDEN KINGDOM 2025 (Full Set)'),
  clip('c-snake', 'dj-snake', 'DJ SNAKE b2b John Summit at Ultra'),
  clip('c-act', 'subtronics-b2b-crankdat', 'Live at Lost Lands'),
  clip('c-plain', 'john-summit', 'John Summit b2b nobody'),
  clip('c-given', 'layz', 'anything b2b kompany', { withArtistIds: ['crankdat'] }),
];
const snapshot: CatalogSnapshot = {
  artists,
  festivals: [{ id: 'f1', name: 'F', dates: 'Oct 1', location: 'X', lineup: ['layz', 'subtronics-b2b-crankdat', 'john-summit'], days: ['Friday'], stages: [{ id: 'main', name: 'Main' }], sets: [{ artistId: 'subtronics-b2b-crankdat', day: 'Friday', stageId: 'main', start: '20:00', end: '21:00' }] }],
  clips,
};
const none = { liked: false, saved: false, skipped: false };

describe('back to back', () => {
  const index = b2bIndex(artists);

  it('knows who is in a b2b act, both ways', () => {
    expect(index.membersOf.get('subtronics-b2b-crankdat')).toEqual(['subtronics', 'crankdat']);
    expect(index.actsOf.get('crankdat')).toEqual(['subtronics-b2b-crankdat']);
    expect(index.membersOf.has('layz')).toBe(false);
  });

  it('finds the other artist named right next to the b2b in a title, several words long, never elsewhere', () => {
    expect(partnersInTitle('B2B KOMPANY FORBIDDEN KINGDOM 2025 (Full Set)', 'layz', index)).toEqual(['kompany']);
    expect(partnersInTitle('DJ SNAKE b2b John Summit at Ultra', 'dj-snake', index)).toEqual(['john-summit']);
    expect(partnersInTitle('Subtronics B2B Crankdat live', 'layz', index)).toEqual(['subtronics', 'crankdat']);
    // Not an artist on Afterglow, and a name mentioned away from the b2b.
    expect(partnersInTitle('John Summit b2b nobody', 'john-summit', index)).toEqual([]);
    expect(partnersInTitle('KOMPANY closing set b2b someone', 'layz', index)).toEqual([]);
    // Never the artist themselves.
    expect(partnersInTitle('LAYZ B2B LAYZ', 'layz', index)).toEqual([]);
  });

  it('fills partners from titles, keeps ones given in the file, and lists everyone playing', () => {
    const filled = withPartners(clips, index);
    expect(partnersOf(filled[0])).toEqual(['kompany']);
    expect(partnersOf(filled[4])).toEqual(['crankdat']);
    expect(partnersOf(filled[3])).toEqual([]);
    expect(withPartners(filled, index)).toBe(filled);
    const members = (id: string) => index.membersOf.get(id) ?? [];
    expect(playersOf(filled[0], members)).toEqual(['layz', 'kompany']);
    expect(playersOf(filled[2], members)).toEqual(['subtronics-b2b-crankdat', 'subtronics', 'crankdat']);
  });

  it('the catalogue lists a b2b under each artist: their clips, their festivals and the act they are in', () => {
    const cat = createCatalog(snapshot);
    expect(cat.clipsOf('kompany').map((c) => c.id)).toEqual(['c-layz']);
    expect(cat.clipsOf('crankdat').map((c) => c.id)).toEqual(['c-act', 'c-given']);
    expect(cat.festivalsOf('crankdat').map((f) => f.id)).toEqual(['f1']);
    expect(cat.festivalsOf('kompany')).toEqual([]);
    expect(cat.membersOf('subtronics-b2b-crankdat')).toEqual(['subtronics', 'crankdat']);
    expect(cat.actsOf('subtronics')).toEqual(['subtronics-b2b-crankdat']);
    expect(cat.playersOf(cat.clip('c-layz')!)).toEqual(['layz', 'kompany']);
  });

  it('a like on a b2b counts for every artist playing, and a b2b act matches like its best-liked artist', () => {
    const cat = createCatalog(snapshot);
    const b2b = { playersOf: cat.playersOf, membersOf: cat.membersOf };
    const { taste, informed } = computeTaste({}, artists, cat.clips, { 'c-layz': { ...none, liked: true } }, undefined, {}, undefined, b2b);
    expect(taste.kompany).toBeCloseTo(taste.layz);
    expect(taste.kompany).toBeGreaterThan(0.5);
    // Nothing said about the act or Subtronics; a like for Crankdat alone lifts the act with him.
    const r = computeTaste({}, artists, cat.clips, { 'c-given': { ...none, liked: true } }, undefined, {}, undefined, b2b);
    expect(r.taste.crankdat).toBeGreaterThan(0.5);
    expect(r.taste['subtronics-b2b-crankdat']).toBeCloseTo(r.taste.crankdat);
    expect(r.informed['subtronics-b2b-crankdat']).toBe(true);
    expect(informed['john-summit']).toBe(false);
  });

  it('Discover ranks a b2b by the artist in it you like best', () => {
    const cat = createCatalog(snapshot);
    const taste = { layz: 0.2, kompany: 0.9, 'dj-snake': 0.3, 'john-summit': 0.3 };
    const items = scoreClips({ clips: cat.clips, artists, taste, informed: { layz: true, kompany: true }, reactions: {}, seen: {}, now: 0 });
    const layz = items.find((i) => i.clip.id === 'c-layz')!;
    expect(layz.score).toBeGreaterThanOrEqual(0.9);
    expect(layz.lane).toBe('personal');
  });

  it('shows the artists together: both names, both faces, and the title without the repeated b2b', () => {
    const t = together([artists[0], artists[1]])!;
    expect(t.id).toBe('layz');
    expect(t.name).toBe('LAYZ b2b KOMPANY');
    expect(t.members?.map((m) => m.name)).toEqual(['LAYZ', 'KOMPANY']);
    // A b2b act brings its own artists' faces.
    const act = together([{ ...artists[4], members: [{ name: 'SUBTRONICS', id: 'subtronics', imageUrl: 'https://x.test/sub.jpg' }, { name: 'CRANKDAT' }] }, artists[0]])!;
    expect(act.members?.map((m) => m.name)).toEqual(['SUBTRONICS', 'CRANKDAT', 'LAYZ']);
    expect(together([artists[0]])).toBe(artists[0]);
    expect(titleWithoutPartners('B2B KOMPANY FORBIDDEN KINGDOM 2025 (Full Set)', ['KOMPANY'])).toBe('FORBIDDEN KINGDOM 2025 (Full Set)');
    expect(titleWithoutPartners('DJ SNAKE b2b John Summit at Ultra', ['JOHN SUMMIT'])).toBe('DJ SNAKE at Ultra');
    expect(titleWithoutPartners('LAYZ B2B KOMPANY', ['KOMPANY'])).toBe('LAYZ');
    expect(titleWithoutPartners('B2B KOMPANY', ['KOMPANY'])).toBe('B2B KOMPANY');
  });
});

describe('b2b acts in the bundled catalogue', () => {
  // Every artist in a b2b act is either on Afterglow by exactly that name, or not close to anyone's:
  // "ALLEYCUT" for ALLEYCVT left the act unlinked to the artist (one letter off).
  const oneOff = (a: string, b: string) => {
    if (a === b || Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
    return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
  };
  it('names each of its artists exactly as they are on Afterglow', () => {
    const all = (bundled as { artists: Artist[] }).artists;
    const names = all.filter((a) => !b2bParts(a.name)).map((a) => fold(a.name));
    const typos = all.flatMap((a) =>
      (b2bParts(a.name) ?? [])
        .map((p) => fold(p))
        .filter((p) => p.length >= 4 && !names.includes(p))
        .flatMap((p) => names.filter((n) => oneOff(p, n)).map((n) => `${a.name}: ${p} ~ ${n}`)),
    );
    expect(typos).toEqual([]);
  });
  it('ALLEYCVT B2B LEVEL UP is played by both', () => {
    const catalog = createCatalog(bundled as unknown as CatalogSnapshot);
    expect(catalog.membersOf('alleycut-b2b-level-up')).toEqual(['alleycvt', 'level-up']);
  });
});
