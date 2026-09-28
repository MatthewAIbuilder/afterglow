/**
 * Starred must-sees, per festival. A planning preference only: starring an
 * artist at one festival says nothing about another, and never touches taste.
 *
 * Pure, so the state provider stays thin and this is easy to test.
 */
export type MustSees = Record<string, string[]>; // festivalId -> artistIds

export const isMustSee = (all: MustSees, festivalId: string, artistId: string) => !!all[festivalId]?.includes(artistId);

export const mustSeesAt = (all: MustSees, festivalId: string): ReadonlySet<string> => new Set(all[festivalId] ?? []);

/** Stars or unstars an artist at one festival, leaving every other festival alone. */
export function toggleMustSee(all: MustSees, festivalId: string, artistId: string): MustSees {
  const here = all[festivalId] ?? [];
  const next = here.includes(artistId) ? here.filter((id) => id !== artistId) : [...here, artistId];
  const { [festivalId]: _, ...rest } = all;
  return next.length ? { ...rest, [festivalId]: next } : rest;
}
