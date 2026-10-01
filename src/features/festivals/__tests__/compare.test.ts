import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival } from '../../../data/models';
import { compareFestivals, compareIds, FIT_TOP, verdictLine } from '../compare';

const artist = (id: string, sound: Artist['sound'] = {}): Artist => ({ id, name: id.toUpperCase(), sound });
const fest = (id: string, lineup: string[]): Festival => ({ id, name: `Fest ${id}`, dates: '', location: '', lineup, days: [], stages: [] });

const artists: Record<string, Artist> = Object.fromEntries(
  [artist('a', { dubstep: 1 }), artist('b', { dubstep: 0.6, riddim: 0.4 }), artist('c', { house: 1 }), artist('d', { house: 1 }), artist('e'), artist('f', { trap: 1 })].map((a) => [a.id, a]),
);
const taste = { a: 0.95, b: 0.85, c: 0.4, d: 0.3, e: 0.5, f: 0.9 };
const informed = { a: true, b: true, c: true, d: true, f: true };
const loves = (id: string) => (taste[id as keyof typeof taste] ?? 0) >= 0.75;
const inputs = { artist: (id: string) => artists[id], taste, informed, loves };

describe('comparing festivals', () => {
  it('fits each festival by its best matches, lists favourites, who is only there and who plays both', () => {
    const bass = fest('bass', ['a', 'b', 'e', 'x-unknown']);
    const house = fest('house', ['c', 'd', 'b', 'f']);
    const c = compareFestivals([bass, house], inputs);
    const [fb, fh] = c.fits;
    // Two known at bass, (0.95 + 0.85) over min(8, 3 real acts) = 3 slots -> 60.
    expect(fb.fit).toBe(Math.round(((0.95 + 0.85) / Math.min(FIT_TOP, 3)) * 100));
    expect(fh.fit).toBe(Math.round(((0.9 + 0.85 + 0.4 + 0.3) / 4) * 100));
    expect(fb.loved.map((a) => a.id)).toEqual(['a', 'b']);
    expect(fb.onlyHere.map((a) => a.id)).toEqual(['a']);
    expect(fh.onlyHere.map((a) => a.id)).toEqual(['f']);
    expect(fb.sounds[0]).toMatchObject({ tag: 'dubstep' });
    expect(c.shared.map((s) => s.artist.id)).toEqual(['b']);
    expect(c.best).toBeUndefined(); // 60 vs 61: a close call
    expect(verdictLine(c)).toMatch(/close call/);
  });

  it('names the best fit when it clearly leads', () => {
    const c = compareFestivals([fest('bass', ['a', 'b']), fest('house', ['c', 'd'])], inputs);
    expect(c.best).toBe('bass');
    expect(verdictLine(c)).toBe('Fest bass fits your sound best: 2 artists you’d love, 2 only there.');
  });

  it('says what to do without signal or with one festival', () => {
    expect(verdictLine(compareFestivals([fest('x', ['e'])], inputs))).toBe('Add a festival to compare.');
    const none = compareFestivals([fest('x', ['e']), fest('y', ['e'])], inputs);
    expect(none.fits[0].fit).toBeUndefined();
    expect(verdictLine(none)).toMatch(/^Rate a few artists/);
  });

  it('reads ids from the link: known ones, once, at most three', () => {
    expect(compareIds('a,b,,a,zz,c,d', (id) => id !== 'zz')).toEqual(['a', 'b', 'c']);
    expect(compareIds(undefined, () => true)).toEqual([]);
  });
});
