import type { Artist, SoundTag } from '../../data/models';
import type { ImportedTaste } from '../taste/engine';
import { genresToSound } from './genres';
import type { CombinedArtist } from './library';
import type { MusicProviderId } from './models';
import { musicKey } from './tally';

/**
 * Your music library as the taste engine's imported layer. Pure.
 *
 * - Library artists Afterglow has (matched by folded name, so "Subtronics"
 *   finds SUBTRONICS) pass on their library strength directly. Two library
 *   records that fold to one catalogue artist count once (the stronger).
 * - Library artists Afterglow doesn't have can still say which sounds you
 *   play, through their genres, when those genres clearly map to a sound.
 *   They never become Afterglow artists and never appear on the map.
 */
export type ImportedMusic = ImportedTaste & {
  /** Which services each matched Afterglow artist came from. */
  from: Record<string, MusicProviderId[]>;
  /** Artists across your libraries, and how many of them Afterglow has. */
  libraryArtists: number;
  matched: number;
};

export const NO_IMPORTED_MUSIC: ImportedMusic = { artists: {}, sounds: [], from: {}, libraryArtists: 0, matched: 0 };

/** Unmatched library artists read for their sound: the strongest this many. */
export const MAX_SOUND_ARTISTS = 200;

export function importedMusic(library: CombinedArtist[], catalogue: Artist[]): ImportedMusic {
  if (!library.length) return NO_IMPORTED_MUSIC;
  const byKey = new Map<string, string>();
  for (const a of catalogue) {
    const k = musicKey(a.name);
    if (k && !byKey.has(k)) byKey.set(k, a.id);
  }
  const artists: Record<string, number> = {};
  const from: Record<string, MusicProviderId[]> = {};
  const sounds: { sound: Partial<Record<SoundTag, number>>; strength: number }[] = [];
  for (const l of library) {
    if (l.strength <= 0) continue;
    const id = byKey.get(l.key);
    if (id) {
      artists[id] = Math.max(artists[id] ?? 0, l.strength);
      from[id] = [...new Set([...(from[id] ?? []), ...l.providers])];
    } else if (sounds.length < MAX_SOUND_ARTISTS) {
      const sound = genresToSound(l.genres);
      if (Object.keys(sound).length) sounds.push({ sound, strength: l.strength });
    }
  }
  return { artists, sounds, from, libraryArtists: library.length, matched: Object.keys(artists).length };
}
