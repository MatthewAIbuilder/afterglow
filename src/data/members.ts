import { fold } from './import/edmtrain';
import type { Artist, ArtistMember, CatalogSnapshot } from './models';

/**
 * B2B acts ("SUBTRONICS B2B CRANKDAT") have no photo of their own anywhere,
 * so their avatar is made from the artists playing: each one's own photo,
 * from Afterglow's artists or the nightly job's member photos. Pure.
 */

/** Most artists drawn in one avatar. */
export const MEMBERS_MAX = 4;

const JOIN = /\s+b[2-4]b\s+/i;

/**
 * The artists in a b2b name, in order: "SUBTRONICS B2B CRANKDAT" ->
 * ["SUBTRONICS", "CRANKDAT"]. A named act with its b2b in brackets
 * ("WITCHING HOUR (JEANIE B2B VAMPA)") gives the bracketed artists.
 * Undefined for anything else: "&" and "x" are usually a duo's own name.
 */
export function b2bParts(name: string): string[] | undefined {
  const inner = name.match(/\(([^()]*)\)\s*$/)?.[1];
  const source = inner && JOIN.test(inner) ? inner : name;
  if (!JOIN.test(source)) return undefined;
  const parts = source
    .split(JOIN)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length >= 2 && parts.length <= MEMBERS_MAX ? parts : undefined;
}

/**
 * The snapshot with `members` on every b2b act that has no photo of its own,
 * when at least one of its artists has a photo: an artist on Afterglow brings
 * their photo, colour and id; anyone else takes a photo from `memberPhotos`
 * (name -> link, matched ignoring case and accents). The same object when
 * nothing changes.
 */
export function withMembers(snapshot: CatalogSnapshot, memberPhotos?: Record<string, string>, credit?: string): CatalogSnapshot {
  const byName = new Map<string, Artist>();
  for (const a of snapshot.artists) if (!b2bParts(a.name) && !byName.has(fold(a.name))) byName.set(fold(a.name), a);
  const photoOf = new Map<string, string>();
  for (const [name, url] of Object.entries(memberPhotos ?? {})) photoOf.set(fold(name), url);

  let changed = false;
  const artists = snapshot.artists.map((a) => {
    if (a.imageUrl) return a;
    const parts = b2bParts(a.name);
    if (!parts) return a;
    const members = parts.map((name): ArtistMember => {
      const own = byName.get(fold(name));
      if (own) return { name: own.name, id: own.id, ...photo(own.imageUrl, own.imageCredit), ...(own.color ? { color: own.color } : {}) };
      return { name, ...photo(photoOf.get(fold(name)), credit) };
    });
    if (!members.some((m) => m.imageUrl)) return a;
    changed = true;
    return { ...a, members };
  });
  return changed ? { ...snapshot, artists } : snapshot;
}

const photo = (imageUrl?: string, imageCredit?: string) => (imageUrl ? (imageCredit ? { imageUrl, imageCredit } : { imageUrl }) : {});

/** The first photo among an artist's own and their b2b members', for a backdrop or link preview. */
export const anyPhoto = (artist: Artist): string | undefined => artist.imageUrl ?? artist.members?.find((m) => m.imageUrl)?.imageUrl;

/** Where an artist's photos are from ("Deezer"), when known. */
export const photoCredit = (artist: Artist): string | undefined =>
  artist.imageUrl ? artist.imageCredit : artist.members?.find((m) => m.imageUrl && m.imageCredit)?.imageCredit;
