import { festivalPhase } from './festival';
import type { Artist, ArtistSimilarity, CatalogSnapshot, Clip, Festival, FestivalLineup, FestivalPhase } from './models';

/**
 * The app's view of a catalogue: the snapshot's records plus fast lookups.
 * Screens and hooks read artists, festivals and clips only through this
 * (via useCatalog), never from mock files, so swapping the mock source for a
 * real one changes nothing above this layer. Pure: no React, no storage.
 */
export type Catalog = {
  artists: Artist[];
  festivals: Festival[];
  clips: Clip[];
  similarities: ArtistSimilarity[];
  artist: (id: string) => Artist | undefined;
  festival: (id: string) => Festival | undefined;
  clip: (id: string) => Clip | undefined;
  /** An artist's clips, in catalogue order. */
  clipsOf: (artistId: string) => Clip[];
  /** Festivals an artist is on the lineup of, in catalogue order. */
  festivalsOf: (artistId: string) => Festival[];
  /** A festival's lineup (and set times, once out) as its own record. */
  lineupOf: (festivalId: string) => FestivalLineup | undefined;
  phaseOf: (festivalId: string) => FestivalPhase | undefined;
};

/** A festival with a separately published lineup applied. */
export function applyLineup(festival: Festival, lineup: FestivalLineup | undefined): Festival {
  if (!lineup) return festival;
  const next: Festival = { ...festival, lineup: [...lineup.artistIds] };
  if (lineup.sets) next.sets = lineup.sets;
  if (lineup.days) next.days = lineup.days;
  if (lineup.stages) next.stages = lineup.stages;
  return next;
}

export function createCatalog(snapshot: CatalogSnapshot): Catalog {
  const lineupFor = new Map((snapshot.lineups ?? []).map((l) => [l.festivalId, l]));
  const festivals = snapshot.festivals.map((f) => applyLineup(f, lineupFor.get(f.id)));
  const { artists, clips } = snapshot;

  const artistBy = new Map(artists.map((a) => [a.id, a]));
  const festivalBy = new Map(festivals.map((f) => [f.id, f]));
  const clipBy = new Map(clips.map((c) => [c.id, c]));
  const clipsBy = new Map<string, Clip[]>();
  for (const c of clips) clipsBy.set(c.artistId, [...(clipsBy.get(c.artistId) ?? []), c]);
  const festivalsBy = new Map<string, Festival[]>();
  for (const f of festivals) for (const id of f.lineup) festivalsBy.set(id, [...(festivalsBy.get(id) ?? []), f]);

  return {
    artists,
    festivals,
    clips,
    similarities: snapshot.similarities ?? [],
    artist: (id) => artistBy.get(id),
    festival: (id) => festivalBy.get(id),
    clip: (id) => clipBy.get(id),
    clipsOf: (id) => clipsBy.get(id) ?? [],
    festivalsOf: (id) => festivalsBy.get(id) ?? [],
    lineupOf: (id) => {
      const f = festivalBy.get(id);
      if (!f) return undefined;
      return f.sets ? { festivalId: id, artistIds: f.lineup, sets: f.sets } : { festivalId: id, artistIds: f.lineup };
    },
    phaseOf: (id) => {
      const f = festivalBy.get(id);
      return f && festivalPhase(f);
    },
  };
}

/** The catalogue without these clips (e.g. ones you flagged as wrong). The same object when none of them is in it. */
export function withoutClips(catalog: Catalog, ids: ReadonlySet<string>): Catalog {
  if (!ids.size || !catalog.clips.some((c) => ids.has(c.id))) return catalog;
  return createCatalog({
    artists: catalog.artists,
    festivals: catalog.festivals,
    clips: catalog.clips.filter((c) => !ids.has(c.id)),
    similarities: catalog.similarities,
  });
}
