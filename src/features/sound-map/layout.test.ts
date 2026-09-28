import { ARTISTS } from '../../data/artists';
import { MOCK_TASTE } from '../../data/tasteProfile';
import type { Artist, SoundTag, TasteProfile } from '../../data/types';
import { bubbleRadius, computeLayout, footprint, MAX_R, type PlacedArtist, soundSimilarity } from './layout';

const TAGS: SoundTag[] = ['melodic-bass', 'dubstep', 'riddim', 'trap', 'techno', 'house'];

/** A denser, made-up lineup with long names, to stress the collision pass. */
const MANY: Artist[] = Array.from({ length: 16 }, (_, i) => ({
  id: `artist-${i}`,
  name: `ARTIST NUMBER ${i}`,
  sound: { [TAGS[i % 6]]: 1, [TAGS[(i + 2) % 6]]: (i % 3) / 3 },
}));
const MANY_TASTE: TasteProfile = Object.fromEntries(MANY.map((a, i) => [a.id, 0.95 - i * 0.04]));

const CASES: [string, Artist[], TasteProfile][] = [
  ['mock lineup', ARTISTS, MOCK_TASTE],
  ['dense lineup', MANY, MANY_TASTE],
];

/** Smallest gap between two circles; negative means they overlap. */
const gap = (ax: number, ay: number, ar: number, bx: number, by: number, br: number) =>
  Math.hypot(ax - bx, ay - by) - ar - br;

const pairs = (bubbles: PlacedArtist[]) =>
  bubbles.flatMap((a, i) => bubbles.slice(i + 1).map((b) => [a, b] as const));

describe('computeLayout', () => {
  it('returns an empty map for no artists', () => {
    expect(computeLayout([], {})).toEqual({
      bubbles: [],
      regions: [],
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
    });
  });

  it.each(CASES)('places every artist exactly once (%s)', (_, artists, taste) => {
    const { bubbles } = computeLayout(artists, taste);
    expect(bubbles.map((b) => b.artist.id).sort()).toEqual(artists.map((a) => a.id).sort());
    for (const b of bubbles) {
      expect(Number.isFinite(b.x)).toBe(true);
      expect(Number.isFinite(b.y)).toBe(true);
    }
  });

  it.each(CASES)('pins the top match at the centre as the biggest bubble (%s)', (_, artists, taste) => {
    const { bubbles } = computeLayout(artists, taste);
    const topId = [...artists].sort((a, b) => taste[b.id] - taste[a.id])[0].id;
    const top = bubbles.find((b) => b.artist.id === topId)!;
    expect(top.x).toBe(0);
    expect(top.y).toBe(0);
    for (const b of bubbles) expect(b.r).toBeLessThanOrEqual(top.r);
  });

  it('pins the top match wherever it sits in the input', () => {
    const reversed = [...ARTISTS].reverse();
    const { bubbles } = computeLayout(reversed, MOCK_TASTE);
    const top = bubbles.find((b) => b.artist.id === 'illenium')!;
    expect([top.x, top.y]).toEqual([0, 0]);
  });

  it('follows the taste profile: a new favourite moves to the centre', () => {
    const taste = { ...MOCK_TASTE, 'john-summit': 0.99 };
    const { bubbles } = computeLayout(ARTISTS, taste);
    const centre = bubbles.find((b) => b.x === 0 && b.y === 0);
    expect(centre?.artist.id).toBe('john-summit');
  });

  it.each(CASES)('never overlaps two bubbles (%s)', (_, artists, taste) => {
    const { bubbles } = computeLayout(artists, taste);
    for (const [a, b] of pairs(bubbles)) {
      expect(gap(a.x, a.y, a.r, b.x, b.y, b.r)).toBeGreaterThan(0);
    }
  });

  it.each(CASES)('never overlaps a bubble or name label with another artist (%s)', (_, artists, taste) => {
    const { bubbles } = computeLayout(artists, taste);
    for (const [a, b] of pairs(bubbles)) {
      for (const pa of footprint(a.artist.name, a.r)) {
        for (const pb of footprint(b.artist.name, b.r)) {
          expect(gap(a.x + pa.dx, a.y + pa.dy, pa.r, b.x + pb.dx, b.y + pb.dy, pb.r)).toBeGreaterThan(0);
        }
      }
    }
  });

  it.each(CASES)('keeps every bubble and label inside the reported bounds (%s)', (_, artists, taste) => {
    const { bubbles, bounds } = computeLayout(artists, taste);
    for (const b of bubbles) {
      for (const p of footprint(b.artist.name, b.r)) {
        expect(b.x + p.dx - p.r).toBeGreaterThanOrEqual(bounds.minX);
        expect(b.x + p.dx + p.r).toBeLessThanOrEqual(bounds.maxX);
        expect(b.y + p.dy - p.r).toBeGreaterThanOrEqual(bounds.minY);
        expect(b.y + p.dy + p.r).toBeLessThanOrEqual(bounds.maxY);
      }
    }
  });

  it.each(CASES)('is deterministic for the same input (%s)', (_, artists, taste) => {
    expect(computeLayout(artists, taste)).toEqual(computeLayout(artists, taste));
  });

  it('does not depend on the order artists are passed in', () => {
    const shuffled = [ARTISTS[3], ARTISTS[6], ARTISTS[0], ARTISTS[5], ARTISTS[1], ARTISTS[4], ARTISTS[2]];
    const byId = (l: ReturnType<typeof computeLayout>) =>
      Object.fromEntries(l.bubbles.map((b) => [b.artist.id, [b.x, b.y, b.r]]));
    expect(byId(computeLayout(shuffled, MOCK_TASTE))).toEqual(byId(computeLayout(ARTISTS, MOCK_TASTE)));
  });

  it('does not mutate its inputs', () => {
    const artists = structuredClone(ARTISTS);
    const taste = { ...MOCK_TASTE };
    computeLayout(artists, taste);
    expect(artists).toEqual(ARTISTS);
    expect(taste).toEqual(MOCK_TASTE);
  });

  it('labels a region for each sound on the map, but not the centre', () => {
    const { regions } = computeLayout(ARTISTS, MOCK_TASTE);
    const tags = regions.map((r) => r.tag).sort();
    // Illenium (melodic bass) is the centre, so melodic bass gets no region.
    expect(tags).toEqual(['dubstep', 'house', 'riddim', 'techno', 'trap']);
  });
});

describe('bubbleRadius', () => {
  it('grows with affinity and stays within its limits', () => {
    const radii = [0, 0.3, 0.5, 0.7, 0.9, 1].map(bubbleRadius);
    for (let i = 1; i < radii.length; i++) expect(radii[i]).toBeGreaterThanOrEqual(radii[i - 1]);
    expect(radii[0]).toBe(radii[1]);
    expect(radii[radii.length - 1]).toBe(MAX_R);
    expect(bubbleRadius(2)).toBe(MAX_R);
  });
});

describe('soundSimilarity', () => {
  const a: Artist = { id: 'a', name: 'A', sound: { dubstep: 1, riddim: 0.5 } };

  it('is 1 for the same sound, 0 for unrelated sounds, and symmetric', () => {
    expect(soundSimilarity(a, { ...a, id: 'b' })).toBeCloseTo(1);
    expect(soundSimilarity(a, { id: 'c', name: 'C', sound: { house: 1 } })).toBe(0);
    const d: Artist = { id: 'd', name: 'D', sound: { dubstep: 0.4, trap: 0.8 } };
    expect(soundSimilarity(a, d)).toBeCloseTo(soundSimilarity(d, a));
  });

  it('is 0 for an artist with no sound', () => {
    expect(soundSimilarity(a, { id: 'e', name: 'E', sound: {} })).toBe(0);
  });
});
