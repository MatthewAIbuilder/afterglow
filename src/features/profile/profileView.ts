import type { Festival } from '../../data/models';
import type { Memory } from '../memories/models';

/**
 * What the Profile tab shows, worked out from plain data so it can be
 * tested: the three counts under your photo, the round shortcuts above the
 * tabs, and your videos newest first. Pure.
 */

export type ProfileStat = { key: 'festivals' | 'followers' | 'following' | 'artists' | 'moments' | 'badges'; n: number; label: string; a11y: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The counts on your profile. With a profile: followers and following first
 * (followers undefined until they've loaded). Then, for everyone, what
 * you've built: festivals, artists rated, moments filmed and badges.
 */
export function profileStats(input: {
  social: boolean;
  festivals: number;
  followers?: number;
  following: number;
  artists: number;
  moments: number;
  badges: number;
}): ProfileStat[] {
  const mine: ProfileStat[] = [
    { key: 'festivals', n: input.festivals, label: 'Festivals', a11y: plural(input.festivals, 'festival', 'festivals') },
    { key: 'artists', n: input.artists, label: 'Artists', a11y: plural(input.artists, 'artist rated', 'artists rated') },
    { key: 'moments', n: input.moments, label: 'Moments', a11y: plural(input.moments, 'moment', 'moments') },
    { key: 'badges', n: input.badges, label: 'Badges', a11y: plural(input.badges, 'badge', 'badges') },
  ];
  if (!input.social) return mine;
  return [
    { key: 'followers', n: input.followers ?? 0, label: 'Followers', a11y: input.followers === undefined ? 'Followers' : plural(input.followers, 'follower', 'followers') },
    { key: 'following', n: input.following, label: 'Following', a11y: `${input.following} following` },
    ...mine,
  ];
}

/** Big numbers stay short under a photo: 1,234 -> "1.2K", 2,500,000 -> "2.5M". */
export function shortCount(n: number): string {
  if (n < 1000) return String(n);
  const [d, s] = n < 1_000_000 ? [1000, 'K'] : [1_000_000, 'M'];
  const v = n / d;
  return `${v < 10 ? Math.floor(v * 10) / 10 : Math.floor(v)}${s}`;
}

export type Highlight =
  | { kind: 'festival'; id: string; title: string; detail: string }
  | { kind: 'year'; year: number; title: string; detail: string }
  | { kind: 'recap'; id: string; title: string; detail: string };

/**
 * The round shortcuts under your profile, like story highlights: festivals
 * you're going to (as given: soonest first), your year once there's
 * something in it, then recaps of festivals that are over.
 */
export function profileHighlights(input: {
  going: { festival: Festival; when: string }[];
  year?: { year: number; soFar: boolean };
  recaps: Festival[];
}): Highlight[] {
  const out: Highlight[] = [];
  for (const g of input.going) out.push({ kind: 'festival', id: g.festival.id, title: g.festival.name, detail: g.when });
  if (input.year) out.push({ kind: 'year', year: input.year.year, title: `Your ${input.year.year}`, detail: input.year.soFar ? 'So far' : 'Ready' });
  for (const f of input.recaps) out.push({ kind: 'recap', id: f.id, title: f.name, detail: 'Recap' });
  return out;
}

/** Your videos for the grid: newest filmed first (then newest added), each once. */
export function videoGrid(memories: readonly Memory[]): Memory[] {
  return [...memories].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt) || b.addedAt.localeCompare(a.addedAt));
}

/** Two or three letters for a festival's round shortcut: "Cyclops Cove 4" -> "CC4", "EDC Orlando 2026" -> "EO". */
export function festivalMark(name: string): string {
  const words = name.replace(/\b20\d\d\b/g, '').split(/\s+/).filter(Boolean);
  const letters = words.map((w) => (/^\d+$/.test(w) ? w : w[0].toUpperCase())).join('');
  return letters.slice(0, 3) || name.slice(0, 2).toUpperCase();
}
