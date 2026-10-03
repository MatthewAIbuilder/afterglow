import { FOUNDERS_MAX, type FlairKind, type Standing } from '../social/models';

/**
 * Standing, pure: how a founder number and a flair read and look. Founders
 * are the first FOUNDERS_MAX people with a profile (a gold ring and a
 * caption); flairs are given by hand to artists, the team and partners.
 */

/** "One of the first 100 on Afterglow · #23": the caption under a founder's name. */
export const founderCaption = (n: number) => `One of the first ${FOUNDERS_MAX} on Afterglow · #${n}`;

/** "Founder #23": short, for small places. */
export const founderShort = (n: number) => `Founder #${n}`;

/** The ring's colours for each kind of standing, brightest first. */
export const RING: Record<'founder' | FlairKind, readonly string[]> = {
  founder: ['#FFF2B0', '#F5C24B', '#B8862B', '#FFE38A', '#E0A93A'],
  artist: ['#FF7EB6', '#A97CFF', '#6FC3FF', '#FF7EB6'],
  team: ['#E9DFFF', '#A97CFF', '#6D4BD8', '#C9B5FF'],
  partner: ['#9FF5DC', '#5BE3B5', '#1E9C8A', '#9FF5DC'],
};

/** The glow around a ring. */
export const GLOW: Record<'founder' | FlairKind, string> = {
  founder: '#F5C24B',
  artist: '#FF7EB6',
  team: '#A97CFF',
  partner: '#5BE3B5',
};

/** Which ring to draw: a flair wins over founder (an artist who was also early shows as the artist). */
export function ringOf(s: Standing | undefined): 'founder' | FlairKind | undefined {
  return s?.flair?.kind ?? (s?.founder ? 'founder' : undefined);
}

/** The captions under a name, flair first. */
export function captionsOf(s: Standing | undefined): { kind: 'founder' | FlairKind; text: string }[] {
  const out: { kind: 'founder' | FlairKind; text: string }[] = [];
  if (s?.flair) out.push({ kind: s.flair.kind, text: s.flair.caption });
  if (s?.founder) out.push({ kind: 'founder', text: founderCaption(s.founder) });
  return out;
}

/** For screen readers, after a name: "Artist. One of the first 100 on Afterglow, number 23." */
export function standingA11y(s: Standing | undefined): string {
  return captionsOf(s)
    .map((c) => (c.kind === 'founder' ? `One of the first ${FOUNDERS_MAX} on Afterglow, number ${s!.founder}` : c.text))
    .join('. ');
}

/** Videos show the edge glow and its AFTERGLOW label unless the person who filmed them has Afterglow Plus. */
export const showsGlow = (s: Standing | undefined) => !s?.plus;
