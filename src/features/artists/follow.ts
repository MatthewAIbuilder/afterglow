import type { Artist, Festival } from '../../data/models';
import { playingList, type Playing } from '../festivals/playing';
import { tn } from '../../i18n';

/**
 * Following artists: a list of the artists you want news about, newest first.
 * Pure. Following is a plan, like going to a festival: it never changes your
 * match, but the artists you follow count as ones you'd love, so the bell
 * says when they're added to a lineup and festival shelves rank by them.
 */
export const FOLLOW_MAX = 500;
/** How many artists "You might follow" suggests. */
export const SUGGEST_MAX = 6;

/** A saved list read back: strings only, no repeats, at most `FOLLOW_MAX`. */
export function cleanFollowed(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) if (typeof x === 'string' && x && !out.includes(x)) out.push(x);
  return out.slice(0, FOLLOW_MAX);
}

/** Follow (newest first) or unfollow. */
export function withFollow(list: readonly string[], id: string, on: boolean): string[] {
  const rest = list.filter((x) => x !== id);
  return on ? [id, ...rest].slice(0, FOLLOW_MAX) : rest;
}

export type FollowedShow = { artist: Artist; next: Playing; more: number };

/**
 * Where the artists you follow play next: those with a festival that isn't
 * over, soonest next show first (a festival you're going to counts first for
 * that artist, as on their page), and those with nothing coming up yet.
 */
export function followedShows(
  followed: readonly string[],
  opts: {
    artist: (id: string) => Artist | undefined;
    festivalsOf: (id: string) => readonly Festival[];
    going: readonly string[];
    today: Date;
    distanceTo?: (f: Festival) => number | undefined;
    nearKm?: number;
  },
): { upcoming: FollowedShow[]; later: Artist[] } {
  const upcoming: (FollowedShow & { rank: number; i: number })[] = [];
  const later: Artist[] = [];
  followed.forEach((id, i) => {
    const artist = opts.artist(id);
    if (!artist) return;
    const open = playingList(opts.festivalsOf(id), opts).filter((p) => !p.over);
    if (!open.length) {
      later.push(artist);
      return;
    }
    const next = open[0];
    upcoming.push({ artist, next, more: open.length - 1, rank: dateRank(next.festival), i });
  });
  upcoming.sort((a, b) => a.rank - b.rank || a.i - b.i);
  return { upcoming: upcoming.map(({ rank: _r, i: _i, ...s }) => s), later };
}

const dateRank = (f: Festival) => (f.startDate ? Date.parse(`${f.startDate}T00:00:00Z`) : Number.MAX_SAFE_INTEGER);

/**
 * Artists worth following: ones you'd love that you don't follow yet and
 * that play somewhere on Afterglow, best match first.
 */
export function followSuggestions(
  artists: readonly Artist[],
  opts: { followed: readonly string[]; loves: (id: string) => boolean; taste: Record<string, number>; plays: (id: string) => boolean; max?: number },
): Artist[] {
  const followed = new Set(opts.followed);
  return artists
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => !followed.has(a.id) && opts.loves(a.id) && opts.plays(a.id))
    .sort((x, y) => (opts.taste[y.a.id] ?? 0) - (opts.taste[x.a.id] ?? 0) || x.i - y.i)
    .slice(0, opts.max ?? SUGGEST_MAX)
    .map(({ a }) => a);
}

/** "3 artists", "1 artist". */
export const artistsCount = (n: number) => tn(n, '{n} artist', '{n} artists');

/** "and 2 more festivals", for under an artist's next show. */
export const moreLine = (n: number) => (n > 0 ? tn(n, '+{n} more festival', '+{n} more festivals') : '');

