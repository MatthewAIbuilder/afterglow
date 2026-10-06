import { slug } from './import/edmtrain';
import type { Artist } from './models';

/**
 * Artists people named on their videos who aren't on Afterglow yet ("REZZ"
 * on a throwback). Each gets the id the catalogue would give them
 * (`newArtistId`), so once HQ adds the artist, their videos are theirs. Until
 * then, `useCatalog().artist(id)` finds them here, by the name typed, so the
 * video shows who's playing everywhere. They never join lineups, Discover's
 * ranking or the taste map. A small shared store, filled as videos are read.
 */
const MAX = 500;
const NAME_MAX = 60;
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

const known = new Map<string, Artist>();
const listeners = new Set<() => void>();
let version = 0;

/** The id a new artist gets: the catalogue's own ("REZZ" -> "rezz", "Seven Lions" -> "seven-lions"). */
export const newArtistId = (name: string) => slug(name.trim());

/** A name typed for a new artist, tidied; undefined when it can't be one. */
export function cleanArtistName(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const name = v.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return name && /[\p{L}\p{N}]/u.test(name) && ID.test(newArtistId(name)) ? name : undefined;
}

/** Remember an artist named on a video (the first name given for an id stays). */
export function noteArtist(id: string | undefined, name: string | undefined): void {
  const clean = cleanArtistName(name);
  if (!id || !clean || !ID.test(id) || known.has(id)) return;
  if (known.size >= MAX) known.delete(known.keys().next().value!);
  known.set(id, { id, name: clean, sound: {} });
  version++;
  listeners.forEach((l) => l());
}

export const extraArtist = (id: string): Artist | undefined => known.get(id);
export const extraArtistsVersion = () => version;

export function subscribeExtraArtists(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** For tests: forget every artist noted. */
export function forgetExtraArtists() {
  known.clear();
  version = 0;
}
