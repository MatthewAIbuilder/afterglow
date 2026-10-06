import { festivalPhase } from './festival';
import type { Artist, ArtistSimilarity, CatalogSnapshot, Clip, Festival, FestivalLineup, FestivalPhase, Show, SoundCloudProfile } from './models';

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
  /** Club shows from the nightly feed, soonest first. */
  shows: Show[];
  /** Artist id -> their SoundCloud page: a link set in the catalogue, else the nightly match. */
  soundcloud: Record<string, SoundCloudProfile>;
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
  /** An artist's club shows, soonest first; only those on or after `from` ("YYYY-MM-DD") when given. */
  showsOf: (artistId: string, from?: string) => Show[];
  /** An artist's SoundCloud page, if they have one. */
  soundcloudOf: (artistId: string) => SoundCloudProfile | undefined;
};

/** Every artist's SoundCloud page: the nightly matches, with links set on the artist winning. */
function soundcloudPages(snapshot: CatalogSnapshot): Record<string, SoundCloudProfile> {
  const out: Record<string, SoundCloudProfile> = {};
  for (const a of snapshot.artists) {
    if (a.soundcloud) out[a.id] = { url: a.soundcloud };
    else if (snapshot.soundcloud?.[a.id]) out[a.id] = snapshot.soundcloud[a.id];
  }
  return out;
}

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
  const shows = [...(snapshot.shows ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const showsBy = new Map<string, Show[]>();
  for (const s of shows) for (const id of s.artistIds) showsBy.set(id, [...(showsBy.get(id) ?? []), s]);
  const soundcloud = soundcloudPages(snapshot);

  return {
    artists,
    festivals,
    clips,
    similarities: snapshot.similarities ?? [],
    shows,
    soundcloud,
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
    showsOf: (id, from) => {
      const all = showsBy.get(id) ?? [];
      return from ? all.filter((s) => s.date >= from) : all;
    },
    soundcloudOf: (id) => soundcloud[id],
  };
}

/** The id of an artist's SoundCloud card in Discover ("soundcloud:<artist id>"): flagging it hides their page. */
export const SOUNDCLOUD_PREFIX = 'soundcloud:';
export const soundcloudCardId = (artistId: string) => `${SOUNDCLOUD_PREFIX}${artistId}`;

/**
 * The catalogue without these clips (e.g. ones you flagged as wrong), and
 * without the SoundCloud pages whose Discover card is among them. The same
 * object when none of them is in it.
 */
export function withoutClips(catalog: Catalog, ids: ReadonlySet<string>): Catalog {
  const pagesOut = Object.keys(catalog.soundcloud).filter((id) => ids.has(soundcloudCardId(id)));
  if (!ids.size || (!pagesOut.length && !catalog.clips.some((c) => ids.has(c.id)))) return catalog;
  const soundcloud = { ...catalog.soundcloud };
  for (const id of pagesOut) delete soundcloud[id];
  const built = createCatalog({
    artists: catalog.artists,
    festivals: catalog.festivals,
    clips: catalog.clips.filter((c) => !ids.has(c.id)),
    similarities: catalog.similarities,
    shows: catalog.shows,
    soundcloud: catalog.soundcloud,
  });
  // Set here, so a flagged link set on the artist doesn't come back from the artist.
  return pagesOut.length ? { ...built, soundcloud, soundcloudOf: (id) => soundcloud[id] } : built;
}
