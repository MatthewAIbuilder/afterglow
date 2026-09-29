import type { MusicArtistSignal, MusicProviderId, MusicSignalSource, MusicState } from './models';
import { artistStrength } from './strength';

/**
 * Every connected service's library as one list of artists. Pure.
 *
 * An artist in both Spotify and Apple Music becomes one record (matched by
 * folded name), strongest evidence kept from each: followed if either says
 * so, the best top rank, the larger saved-song count (the same song saved in
 * both is one song, so counts are never added up). `providers` says which
 * services mention them; each service's own ids stay in its own snapshot.
 */
export type CombinedArtist = {
  key: string;
  /** The name as the strongest service writes it. */
  name: string;
  providers: MusicProviderId[];
  savedTracks: number;
  followed: boolean;
  topRank?: number;
  recent: boolean;
  genres: string[];
  sources: MusicSignalSource[];
  /** How strongly the libraries say you like them, 0 to 1 (see strength.ts). */
  strength: number;
};

/**
 * The artists of every saved snapshot. A service whose sign-in expired keeps
 * its last good import until you disconnect it. Each snapshot only speaks
 * for its own service: a record claiming another provider is ignored.
 */
export function librarySignals(state: MusicState): MusicArtistSignal[][] {
  return Object.values(state)
    .filter((c) => !!c?.snapshot)
    .map((c) => c!.snapshot!.artists.filter((a) => a.provider === c!.provider));
}

export function combineLibraries(libraries: MusicArtistSignal[][]): CombinedArtist[] {
  const byKey = new Map<string, CombinedArtist>();
  for (const artists of libraries) {
    for (const a of artists) {
      if (!a.key) continue;
      const c = byKey.get(a.key);
      if (!c) {
        byKey.set(a.key, {
          key: a.key,
          name: a.name,
          providers: [a.provider],
          savedTracks: a.savedTracks,
          followed: !!a.followed,
          topRank: a.topRank,
          recent: !!a.recent,
          genres: [...a.genres],
          sources: [...a.sources],
          strength: 0,
        });
        continue;
      }
      if (!c.providers.includes(a.provider)) c.providers.push(a.provider);
      c.savedTracks = Math.max(c.savedTracks, a.savedTracks);
      c.followed ||= !!a.followed;
      if (a.topRank !== undefined) c.topRank = Math.min(c.topRank ?? Infinity, a.topRank);
      c.recent ||= !!a.recent;
      for (const g of a.genres) if (!c.genres.includes(g)) c.genres.push(g);
      for (const s of a.sources) if (!c.sources.includes(s)) c.sources.push(s);
    }
  }
  return [...byKey.values()]
    .map((c) => ({ ...c, strength: artistStrength(c) }))
    .sort((a, b) => b.strength - a.strength || a.key.localeCompare(b.key));
}
