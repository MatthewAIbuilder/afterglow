import type { Artist, Festival } from '../../data/models';
import { anyPhoto } from '../../data/members';
import type { Ratings } from './ratings';

/**
 * Pick the artists you know: a grid to tap through in seconds, faster than
 * rating one at a time. Pure. The artists come from the festivals you chose
 * (or every festival), best known first: how many festivals they play (on
 * Afterglow), then whether their sound is known and they have a photo; ties
 * keep the lineups' own order, taking turns between them. Anyone you've
 * already rated is left out.
 */
export const PICK_PAGE = 30;

export function pickCandidates(
  festivals: readonly Pick<Festival, 'lineup'>[],
  artist: (id: string) => Artist | undefined,
  ratings: Ratings,
  /** How many festivals on Afterglow each artist plays. */
  plays: (id: string) => number = () => 1,
): Artist[] {
  const out: Artist[] = [];
  const seen = new Set<string>();
  const longest = Math.max(0, ...festivals.map((f) => f.lineup.length));
  for (let i = 0; i < longest; i++) {
    for (const f of festivals) {
      const id = f.lineup[i];
      if (!id || seen.has(id) || ratings[id]) continue;
      seen.add(id);
      const a = artist(id);
      if (a) out.push(a);
    }
  }
  const known = (a: Artist) => plays(a.id) + (Object.keys(a.sound).length ? 1 : 0) + (anyPhoto(a) ? 0.5 : 0);
  return out
    .map((a, i) => ({ a, i, k: known(a) }))
    .sort((p, q) => q.k - p.k || p.i - q.i)
    .map(({ a }) => a);
}

/** What the grid's button says. */
export function pickDoneLabel(picked: number): string {
  return picked === 0 ? 'Skip for now' : `Done · ${picked} picked`;
}
