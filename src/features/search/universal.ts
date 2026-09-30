import type { Artist, Festival } from '../../data/models';
import { nameRank, normalize, searchArtists, searchFestivals } from '../festivals/search';

/**
 * One search for everything: festivals, artists and people. Pure. Typing
 * "@" first looks for people only. What you opened is remembered as a
 * recent search (kind, id and the name to show), newest first.
 */
export type Found = { festivals: Festival[]; artists: Artist[]; peopleOnly: boolean };

/** At most this many festivals and artists are listed. */
export const FESTIVALS_SHOWN = 4;
export const ARTISTS_SHOWN = 8;
/** People are searched from this many letters (not counting "@"). */
export const PEOPLE_FROM = 2;

/** Artists that match equally well by name come in order of your match (`taste`), best first. */
export function searchCatalog(query: string, catalog: { artists: Artist[]; festivals: Festival[] }, taste: Record<string, number> = {}): Found {
  const q = query.trim();
  if (q.startsWith('@')) return { festivals: [], artists: [], peopleOnly: true };
  const nq = normalize(q);
  const artists = searchArtists(catalog.artists, q)
    .map((a, i) => ({ a, i, r: nameRank(a.name, nq), m: taste[a.id] ?? 0 }))
    .sort((x, y) => x.r - y.r || y.m - x.m || x.i - y.i)
    .slice(0, ARTISTS_SHOWN)
    .map((x) => x.a);
  return { festivals: searchFestivals(catalog.festivals, q).slice(0, FESTIVALS_SHOWN), artists, peopleOnly: false };
}

/** Whether a search is long enough to look for people. */
export const searchesPeople = (query: string) => query.trim().replace(/^@+/, '').length >= PEOPLE_FROM;

export type RecentKind = 'festival' | 'artist' | 'person';
/** `id` is the festival or artist id, or the person's handle. */
export type Recent = { kind: RecentKind; id: string; label: string };

/** Recent searches kept. */
export const RECENTS_MAX = 8;

export function addRecent(list: Recent[], item: Recent): Recent[] {
  return [item, ...list.filter((r) => !(r.kind === item.kind && r.id === item.id))].slice(0, RECENTS_MAX);
}

export function removeRecent(list: Recent[], item: Recent): Recent[] {
  return list.filter((r) => !(r.kind === item.kind && r.id === item.id));
}

/** Saved recents read back safely. */
export function cleanRecents(raw: unknown): Recent[] {
  if (!Array.isArray(raw)) return [];
  const kinds: RecentKind[] = ['festival', 'artist', 'person'];
  return raw
    .filter((r): r is Recent => !!r && typeof r === 'object' && kinds.includes((r as Recent).kind) && typeof (r as Recent).id === 'string' && typeof (r as Recent).label === 'string')
    .slice(0, RECENTS_MAX);
}

/** Recents still worth showing: festivals and artists that are still on Afterglow (people are checked when opened). */
export function liveRecents(list: Recent[], has: { festival: (id: string) => boolean; artist: (id: string) => boolean }): Recent[] {
  return list.filter((r) => (r.kind === 'festival' ? has.festival(r.id) : r.kind === 'artist' ? has.artist(r.id) : true));
}

/** Before you type: your best matches, to jump straight to. */
export function topArtists(artists: Artist[], taste: Record<string, number>, informed: Record<string, boolean>, max = 6): Artist[] {
  return artists
    .filter((a) => informed[a.id])
    .map((a, i) => ({ a, i, m: taste[a.id] ?? 0 }))
    .sort((x, y) => y.m - x.m || x.i - y.i)
    .slice(0, max)
    .map((x) => x.a);
}
