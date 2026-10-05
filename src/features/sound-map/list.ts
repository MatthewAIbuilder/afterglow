import { SOUND_TAGS, type Artist, type SoundTag, type TasteProfile } from '../../data/models';
import { carriesSound, SOUND_MIN } from '../festivals/search';
import { mapSearch, type MapSearch } from './search';

/**
 * My Sound as a ranked list: every artist the map draws from (everyone, or
 * one festival's lineup), best match first. Pure.
 *
 * Artists the app knows something about (`informed`: a starting guess, or
 * signal from what you did, spilling over to similar sounds) are ranked.
 * The rest wait below a "show more" until you ask for them, or until a
 * search names them; they're marked new rather than given a rank.
 */

/** How many sounds a row names (the ones the artist carries most). */
export const ROW_SOUNDS = 2;

export type ListSort = 'match' | 'name';

export type ListRow = {
  artist: Artist;
  /** 1 for your best match, among the artists the app knows something about; none for the rest. */
  rank?: number;
  /** Predicted match, 0 to 1. */
  match: number;
  /** The sounds they carry most (at most ROW_SOUNDS), strongest first. */
  sounds: SoundTag[];
};

export type Ranking = { ranked: ListRow[]; rest: ListRow[] };

/** The sounds an artist carries most, strongest first; their strongest one even when nothing is clear-cut. */
export function mainSounds(artist: Pick<Artist, 'sound'>, max = ROW_SOUNDS): SoundTag[] {
  const by = SOUND_TAGS.filter((t) => (artist.sound[t] ?? 0) > 0).sort((a, b) => (artist.sound[b] ?? 0) - (artist.sound[a] ?? 0));
  const clear = by.filter((t) => (artist.sound[t] ?? 0) >= SOUND_MIN);
  return clear.length ? clear.slice(0, max) : by.slice(0, 1);
}

const byName = (a: Artist, b: Artist) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
const byMatch = (taste: TasteProfile) => (a: Artist, b: Artist) => (taste[b.id] ?? 0) - (taste[a.id] ?? 0) || byName(a, b);

/** Everyone in scope, split into ranked (best match first) and the rest (likeliest first). */
export function rankArtists(candidates: readonly Artist[], taste: TasteProfile, informed: Record<string, boolean>): Ranking {
  const row = (artist: Artist, rank?: number): ListRow => ({ artist, rank, match: Math.max(0, Math.min(1, taste[artist.id] ?? 0)), sounds: mainSounds(artist) });
  const order = byMatch(taste);
  const known = candidates.filter((a) => informed[a.id]).sort(order);
  const unknown = candidates.filter((a) => !informed[a.id]).sort(order);
  return { ranked: known.map((a, i) => row(a, i + 1)), rest: unknown.map((a) => row(a)) };
}

export type ListOptions = {
  /** What was typed: an artist or a sound, as on the map ("dub" finds the dubstep artists). */
  query?: string;
  /** Only artists carrying this sound. */
  sound?: SoundTag;
  sort?: ListSort;
  /** Show the artists the app knows nothing about yet too. */
  showRest?: boolean;
};

export type ListView = {
  rows: ListRow[];
  /** Each sound the listed artists carry (before the sound filter), with how many, in the app's sound order. */
  counts: { tag: SoundTag; count: number }[];
  /** Artists left out until "show more" (matching the search and sound). */
  hidden: number;
  search: MapSearch | undefined;
};

/**
 * What the list shows: the search and sound filter applied, sorted. A search
 * reaches everyone (as the map's does); otherwise only ranked artists show
 * until `showRest`.
 */
export function listView({ ranked, rest }: Ranking, { query = '', sound, sort = 'match', showRest = false }: ListOptions = {}): ListView {
  const search = mapSearch([...ranked, ...rest].map((r) => r.artist), query);
  const found = (r: ListRow) => !search || search.ids.has(r.artist.id);
  const withRest = showRest || !!search;
  const pool = [...ranked.filter(found), ...(withRest ? rest.filter(found) : [])];
  const counts = SOUND_TAGS.map((tag) => ({ tag, count: pool.filter((r) => carriesSound(r.artist, tag)).length })).filter((c) => c.count > 0);
  const inSound = (r: ListRow) => !sound || carriesSound(r.artist, sound);
  const rows = pool.filter(inSound);
  if (sort === 'name') rows.sort((a, b) => byName(a.artist, b.artist));
  const hidden = withRest ? 0 : rest.filter((r) => found(r) && inSound(r)).length;
  return { rows, counts, hidden, search };
}
