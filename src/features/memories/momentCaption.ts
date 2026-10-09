import type { Artist, Festival } from '../../data/models';
import type { PastEvent } from './past';
import type { ShowTag } from './show';

/**
 * What a moment's tile says: who was playing (everyone in a b2b, main artist
 * first) and where ("EDC Orlando ’26", a throwback, or the night's name). Pure,
 * shared by your own profile grid and everyone else's.
 */
export type MomentCaption = {
  /** The main artist first, then whoever played back to back with them. */
  artists: string[];
  where?: string;
  /** Filmed at a festival from before Afterglow knew it. */
  throwback: boolean;
};

type Tagged = {
  artistId?: string;
  withArtistIds?: readonly string[];
  artistName?: string;
  festivalId?: string;
  past?: PastEvent;
  show?: ShowTag;
};

type Lookup = { festival: (id: string) => Festival | undefined; artist: (id: string) => Artist | undefined };

/** "EDC Orlando 2026" → "EDC Orlando ’26"; a name without a year stays as it is. */
export const shortYear = (name: string) => name.replace(/\s*\b20(\d\d)\b\s*$/, ' ’$1').trim();

export function momentCaption(m: Tagged, lookup: Lookup): MomentCaption {
  const main = m.artistId ? (lookup.artist(m.artistId)?.name ?? m.artistName) : m.artistName;
  const others = (m.withArtistIds ?? []).map((id) => lookup.artist(id)?.name).filter((n): n is string => !!n);
  const artists = main ? [main, ...others] : [];
  if (m.past) return { artists, where: `${m.past.name} ’${String(m.past.year).slice(2)}`, throwback: true };
  if (m.show) return { artists, where: m.show.name, throwback: false };
  const festival = m.festivalId ? lookup.festival(m.festivalId)?.name : undefined;
  return { artists, where: festival ? shortYear(festival) : undefined, throwback: false };
}
