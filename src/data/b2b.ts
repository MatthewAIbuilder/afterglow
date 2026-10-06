import { fold } from './import/edmtrain';
import { b2bParts } from './members';
import type { Artist, Clip } from './models';

/**
 * Back to back, everywhere: a b2b is just two (or more) artists playing
 * together. A b2b act on a lineup ("SUBTRONICS B2B CRANKDAT") is played by
 * its artists; a set video titled "LAYZ B2B KOMPANY" is a set by both. This
 * works out who's playing, so a like, a save or a skip counts for each of
 * them, each one's page lists the set, and Discover names them all. Pure.
 */

/** Words a b2b is written with: "b2b", "B3B", "b4b". */
const JOIN = /^b[2-4]b$/i;
/** Longest artist name looked for next to a "b2b", in words. */
const NAME_WORDS = 5;
/** Most partners found in one title. */
export const PARTNERS_MAX = 3;

export type B2bIndex = {
  /** Folded name -> artist id, for artists who aren't b2b acts themselves. */
  byName: Map<string, string>;
  /** A b2b act's id -> its artists' ids (those on Afterglow), in name order. */
  membersOf: Map<string, string[]>;
  /** An artist's id -> the b2b acts they're in. */
  actsOf: Map<string, string[]>;
};

export function b2bIndex(artists: readonly Artist[]): B2bIndex {
  const byName = new Map<string, string>();
  for (const a of artists) {
    const key = fold(a.name);
    if (key && !b2bParts(a.name) && !byName.has(key)) byName.set(key, a.id);
  }
  const membersOf = new Map<string, string[]>();
  const actsOf = new Map<string, string[]>();
  for (const a of artists) {
    const parts = b2bParts(a.name);
    if (!parts) continue;
    const ids = [...new Set(parts.map((p) => byName.get(fold(p))).filter((id): id is string => !!id && id !== a.id))];
    if (!ids.length) continue;
    membersOf.set(a.id, ids);
    for (const id of ids) actsOf.set(id, [...(actsOf.get(id) ?? []), a.id]);
  }
  return { byName, membersOf, actsOf };
}

/**
 * The other artists a video title names next to a "b2b": "B2B KOMPANY
 * FORBIDDEN KINGDOM 2025" on a LAYZ set -> ["kompany"]. Only artists on
 * Afterglow, matched right beside the "b2b" (the longest name that fits), so
 * a word elsewhere in the title never counts. Never the video's own artist.
 */
export function partnersInTitle(title: string, mainId: string, index: B2bIndex): string[] {
  const words = title.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  const own = new Set([mainId, ...(index.membersOf.get(mainId) ?? [])]);
  const add = (id: string | undefined) => {
    if (id && !own.has(id) && !out.includes(id) && out.length < PARTNERS_MAX) out.push(id);
  };
  const nameAt = (from: number, to: number) => index.byName.get(fold(words.slice(from, to).join(' ')));
  for (let j = 0; j < words.length; j++) {
    if (!JOIN.test(words[j].replace(/[^a-z0-9]/gi, ''))) continue;
    // Before the "b2b" (a title that names both: "SUBTRONICS B2B CRANKDAT"): the longest run of words that's an artist's name.
    for (let k = Math.min(NAME_WORDS, j); k >= 1; k--) {
      const id = nameAt(j - k, j);
      if (id) {
        add(id);
        break;
      }
    }
    // Then after it.
    for (let k = Math.min(NAME_WORDS, words.length - j - 1); k >= 1; k--) {
      const id = nameAt(j + 1, j + 1 + k);
      if (id) {
        add(id);
        break;
      }
    }
  }
  return out;
}

/** The clips with `withArtistIds` filled in from their titles where none was given. The same array when nothing changes. */
export function withPartners(clips: readonly Clip[], index: B2bIndex): Clip[] {
  let changed = false;
  const out = clips.map((c) => {
    if (c.withArtistIds?.length || !/\bb[2-4]b\b/i.test(c.title)) return c;
    const found = partnersInTitle(c.title, c.artistId, index);
    if (!found.length) return c;
    changed = true;
    return { ...c, withArtistIds: found };
  });
  return changed ? out : (clips as Clip[]);
}

/** The other artists on a clip: its own `withArtistIds`, or a crowd video's. */
export const partnersOf = (clip: Clip): readonly string[] =>
  clip.withArtistIds ?? (clip.source?.provider === 'community' ? (clip.source.withArtistIds ?? []) : []);

/**
 * Everyone playing in a clip, its own artist first: the partners, and for a
 * b2b act, the artists in it. Each once.
 */
export function playersOf(clip: Clip, membersOf: (artistId: string) => readonly string[]): string[] {
  const out: string[] = [];
  for (const id of [clip.artistId, ...partnersOf(clip)]) for (const p of [id, ...membersOf(id)]) if (!out.includes(p)) out.push(p);
  return out;
}

/**
 * Artists playing together drawn as one: "LAYZ b2b KOMPANY", with each one's
 * photo in a slice of the avatar (a b2b act's own artists in its place). The
 * first artist's id, so it opens their page. One artist is returned as is.
 */
export function together(players: readonly Artist[]): Artist | undefined {
  const [first] = players;
  if (players.length < 2) return first;
  const members = players.flatMap((a) =>
    a.members?.length && !a.imageUrl
      ? a.members
      : [{ name: a.name, id: a.id, ...(a.imageUrl ? { imageUrl: a.imageUrl } : {}), ...(a.imageCredit ? { imageCredit: a.imageCredit } : {}), ...(a.color ? { color: a.color } : {}) }],
  );
  const { imageUrl: _photo, imageCredit: _credit, ...rest } = first;
  return { ...rest, name: players.map((a) => a.name).join(' b2b '), members: members.slice(0, 4) };
}

/**
 * A set video's title without the b2b it already shows above it: "B2B
 * KOMPANY FORBIDDEN KINGDOM 2025 (Full Set)" with KOMPANY named -> "FORBIDDEN
 * KINGDOM 2025 (Full Set)". The title as it was when nothing's left.
 */
export function titleWithoutPartners(title: string, partnerNames: readonly string[]): string {
  let out = title;
  for (const name of partnerNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\s*\\bb[2-4]b\\s+${escaped}(?=\\s|$|[^\\p{L}\\p{N}])`, 'iu'), '');
  }
  out = out.replace(/^[\s\-–—|:·]+/, '').trim();
  return out || title;
}
