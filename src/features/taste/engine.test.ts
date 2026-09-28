import { ARTISTS } from '../../data/artists';
import { CLIPS } from '../../data/clips';
import { MOCK_TASTE } from '../../data/tasteProfile';
import type { Artist, Clip, TasteProfile } from '../../data/types';
import type { Reaction } from '../../state/reactions';
import { computeTaste } from './engine';

// A tiny world where similarity is obvious: two dubstep artists and one house artist.
const ARTISTS_SMALL: Artist[] = [
  { id: 'heavy', name: 'HEAVY', sound: { dubstep: 1 } },
  { id: 'heavier', name: 'HEAVIER', sound: { dubstep: 0.9, riddim: 0.3 } },
  { id: 'groove', name: 'GROOVE', sound: { house: 1 } },
];
const clip = (id: string, artistId: string): Clip => ({
  id,
  artistId,
  festivalId: 'f',
  title: id,
  durationSec: 20,
  bpm: 150,
});
const CLIPS_SMALL: Clip[] = [clip('h1', 'heavy'), clip('h2', 'heavy'), clip('h3', 'heavy'), clip('g1', 'groove')];
const BASE: TasteProfile = { heavy: 0.5, heavier: 0.5, groove: 0.5 };

const R = (r: Partial<Reaction>): Reaction => ({ liked: false, saved: false, skipped: false, ...r });
const run = (reactions: Record<string, Reaction>, base: TasteProfile = BASE) =>
  computeTaste(base, ARTISTS_SMALL, CLIPS_SMALL, reactions);

describe('computeTaste', () => {
  it('leaves the starting taste alone when there are no reactions', () => {
    const { taste, summary } = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, {});
    expect(taste).toEqual(MOCK_TASTE);
    expect(summary).toEqual({ likes: 0, saves: 0, skips: 0 });
  });

  it('starts artists missing from the starting taste at 50%', () => {
    expect(run({}, {}).taste).toEqual({ heavy: 0.5, heavier: 0.5, groove: 0.5 });
  });

  it('raises the match for a liked artist', () => {
    expect(run({ h1: R({ liked: true }) }).taste.heavy).toBeGreaterThan(BASE.heavy);
  });

  it('raises the match for a saved artist, a little more than a like', () => {
    const liked = run({ h1: R({ liked: true }) }).taste.heavy;
    const saved = run({ h1: R({ saved: true }) }).taste.heavy;
    expect(saved).toBeGreaterThan(BASE.heavy);
    expect(saved).toBeGreaterThan(liked);
  });

  it('lowers the match for a skipped artist', () => {
    expect(run({ h1: R({ skipped: true }) }).taste.heavy).toBeLessThan(BASE.heavy);
  });

  it('ignores a skip on a clip that was also liked', () => {
    const { taste, summary } = run({ h1: R({ liked: true, skipped: true }) });
    expect(taste).toEqual(run({ h1: R({ liked: true }) }).taste);
    expect(summary.skips).toBe(0);
  });

  it('adds up repeated signals for the same artist', () => {
    const once = run({ h1: R({ liked: true }) }).taste.heavy;
    const twice = run({ h1: R({ liked: true }), h2: R({ liked: true }) }).taste.heavy;
    expect(twice).toBeGreaterThan(once);
  });

  it('spills a like over to similar sounds, but not to unrelated ones', () => {
    const { taste } = run({ h1: R({ liked: true }) });
    expect(taste.heavier).toBeGreaterThan(BASE.heavier);
    expect(taste.heavier).toBeLessThan(taste.heavy);
    expect(taste.groove).toBe(BASE.groove);
  });

  it('spills a skip over to similar sounds, but not to unrelated ones', () => {
    const { taste } = run({ h1: R({ skipped: true }) });
    expect(taste.heavier).toBeLessThan(BASE.heavier);
    expect(taste.heavier).toBeGreaterThan(taste.heavy);
    expect(taste.groove).toBe(BASE.groove);
  });

  it('spills over within the real lineup too', () => {
    // Subtronics (riddim, dubstep) and Levity (dubstep, riddim) sound alike.
    const { taste } = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { c2: R({ liked: true }) });
    expect(taste.levity).toBeGreaterThan(MOCK_TASTE.levity);
    expect(taste['john-summit']).toBe(MOCK_TASTE['john-summit']);
  });

  it('moves strong matches less than middling ones', () => {
    const high = run({ h1: R({ liked: true }) }, { ...BASE, heavy: 0.95 }).taste.heavy - 0.95;
    const mid = run({ h1: R({ liked: true }) }, { ...BASE, heavy: 0.5 }).taste.heavy - 0.5;
    expect(high).toBeGreaterThan(0);
    expect(high).toBeLessThan(mid);
  });

  it('keeps scores within bounds under heavy liking and saving', () => {
    const all = { liked: true, saved: true };
    const { taste } = run({ h1: R(all), h2: R(all), h3: R(all) }, { heavy: 0.99, heavier: 0.99, groove: 0.99 });
    for (const v of Object.values(taste)) {
      expect(v).toBeLessThanOrEqual(0.99);
      expect(v).toBeGreaterThanOrEqual(0.05);
    }
  });

  it('keeps scores within bounds under heavy skipping', () => {
    const { taste } = run(
      { h1: R({ skipped: true }), h2: R({ skipped: true }), h3: R({ skipped: true }), g1: R({ skipped: true }) },
      { heavy: 0.01, heavier: 0.01, groove: 0.01 },
    );
    for (const v of Object.values(taste)) {
      expect(v).toBeGreaterThanOrEqual(0.05);
      expect(v).toBeLessThanOrEqual(0.99);
    }
  });

  it('keeps every score within bounds for any mix of reactions', () => {
    // Walk through every like/save/skip combination on every mock clip.
    for (let mask = 0; mask < 8; mask++) {
      const reactions = Object.fromEntries(
        CLIPS.map((c, i) => {
          const m = (mask + i) % 8;
          return [c.id, R({ liked: !!(m & 1), saved: !!(m & 2), skipped: !!(m & 4) })];
        }),
      );
      const { taste } = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, reactions);
      for (const a of ARTISTS) {
        expect(taste[a.id]).toBeGreaterThanOrEqual(0.05);
        expect(taste[a.id]).toBeLessThanOrEqual(0.99);
      }
    }
  });

  it('counts likes, saves and skips, and ignores clips it does not know', () => {
    const { summary } = run({
      h1: R({ liked: true, saved: true }),
      h2: R({ skipped: true }),
      g1: R({ saved: true }),
      gone: R({ liked: true }),
    });
    expect(summary).toEqual({ likes: 1, saves: 2, skips: 1 });
  });

  it('is deterministic and does not mutate its inputs', () => {
    const reactions = { h1: R({ liked: true }), g1: R({ skipped: true }) };
    const base = { ...BASE };
    const first = run(reactions, base);
    expect(run(reactions, base)).toEqual(first);
    expect(base).toEqual(BASE);
    expect(reactions).toEqual({ h1: R({ liked: true }), g1: R({ skipped: true }) });
  });
});
