/**
 * Afterglow's domain models: what the app knows about artists, festivals and
 * clips, independent of where that knowledge comes from. Mock data fills them
 * today; a real catalogue (an API, a CMS, a partner feed) fills the same
 * shapes later, so screens and recommendation logic don't change.
 *
 * Rules for these types:
 * - Plain data only (no functions, no classes), so they can be serialised,
 *   cached and sent between a server and the app unchanged.
 * - Everything points at everything else by id, never by nesting a copy.
 * - Optional fields are things a real source may not have yet (a photo, set
 *   times, a poster); the UI already copes with each one missing.
 */

/** Sound regions used to place artists on the map. Extend freely. */
export type SoundTag = 'melodic-bass' | 'dubstep' | 'riddim' | 'trap' | 'techno' | 'house' | 'pop' | 'indie' | 'rock' | 'hip-hop';

// Electronic sounds first, then the sounds of the wider festivals (ACL and the like). New sounds go at the end.
export const SOUND_TAGS: readonly SoundTag[] = ['melodic-bass', 'dubstep', 'riddim', 'trap', 'techno', 'house', 'pop', 'indie', 'rock', 'hip-hop'];

export const SOUND_LABEL: Record<SoundTag, string> = {
  'melodic-bass': 'Melodic bass',
  dubstep: 'Dubstep',
  riddim: 'Riddim',
  trap: 'Trap',
  techno: 'Techno',
  house: 'House',
  pop: 'Pop',
  indie: 'Indie',
  rock: 'Rock',
  'hip-hop': 'Hip-hop',
};

export type Artist = {
  id: string;
  name: string;
  /** Remote image. Leave undefined to show the gradient monogram. */
  imageUrl?: string;
  /** Where a photo that came from a photo list is from ("Deezer"), credited on the artist page. */
  imageCredit?: string;
  /** Their colour ("#8E6BFF"), taken from their photo; tints their avatar, bubble glow and stage. */
  color?: string;
  /** How much of each sound this artist carries, 0 to 1. */
  sound: Partial<Record<SoundTag, number>>;
  /**
   * The sound is Afterglow's guess, from the festivals they play and who
   * they're billed with (`withGuessedSounds` in data/soundGuess.ts), not
   * tags anyone set: said so on their page, and trusted a little less.
   */
  soundGuessed?: boolean;
  /**
   * The artists playing together in a b2b ("SUBTRONICS B2B CRANKDAT"), in
   * name order, with their own photos: worked out from the name for b2b acts
   * without a photo of their own (`withMembers` in data/members.ts).
   */
  members?: ArtistMember[];
  /**
   * Their SoundCloud page ("https://soundcloud.com/subtronics"), set by hand
   * in the catalogue. Always wins over the nightly match (`CatalogSnapshot.soundcloud`).
   */
  soundcloud?: string;
};

/**
 * An artist's own SoundCloud page, matched each night by name through
 * SoundCloud's public oEmbed answer (scripts/soundcloud-artists.ts), or set by
 * hand. Played in Discover with SoundCloud's official embedded player.
 */
export type SoundCloudProfile = {
  /** "https://soundcloud.com/subtronics". */
  url: string;
  /** The name on the page, as SoundCloud shows it. */
  name?: string;
  /** The page's picture (https), for when Afterglow has no photo of the artist. */
  image?: string;
};

/** One of the artists in a b2b, with their photo when Afterglow has one. */
export type ArtistMember = {
  name: string;
  /** Their own artist id, when they're on Afterglow too. */
  id?: string;
  imageUrl?: string;
  imageCredit?: string;
  color?: string;
};

/**
 * How alike two artists are, 0 to 1, when a source knows better than their
 * sound tags (for example listening data from a partner). Symmetric: one
 * record covers both directions. Pairs without a record fall back to
 * comparing sound tags, so none are required.
 */
export type ArtistSimilarity = {
  artistId: string;
  otherId: string;
  score: number;
};

/** Predicted affinity per artist, 0 to 1. Comes from the taste engine; a starting prior seeds it. */
export type TasteProfile = Record<string, number>;

export type Stage = { id: string; name: string };

/** One artist's set. Only exists once the festival publishes set times. */
export type SetTime = {
  artistId: string;
  day: string;
  stageId: string;
  /** 24-hour local time, e.g. "23:40". Times after midnight belong to the night they start in. */
  start: string;
  end: string;
};

/** The same as SetTime, under the name used when talking about the data layer ("Set" is taken by JavaScript). */
export type FestivalSet = SetTime;

export type Festival = {
  id: string;
  name: string;
  dates: string;
  location: string;
  /**
   * Where it is on the map (the venue), for "Near you". Imported festivals
   * carry the venue's coordinates; the phone looks up the rest from `location`.
   */
  place?: { lat: number; lon: number };
  /** Link to the official lineup poster, if you have one. Tap to view full screen. */
  posterImageUrl?: string;
  /**
   * Where the poster came from when it's the picture the festival's own site
   * shares ("orlando.edc.com"), rather than one set in the catalogue. It may
   * be key art rather than the full lineup, so it's credited, not called the poster.
   */
  posterFrom?: string;
  /**
   * Official links (https only): where to buy tickets, the festival's own site,
   * and where to stay (a partner link). `ticketsPartner` marks a tickets link
   * that earns Afterglow a commission (still the official seller), so the page
   * says so beside it.
   */
  links?: { tickets?: string; website?: string; stay?: string; ticketsPartner?: boolean };
  /** Where an imported festival's details came from (credited on its page), e.g. { name: 'EDMTrain', url }. */
  source?: { name: string; url: string };
  /** Everyone announced, in billing order. Available months ahead. */
  lineup: string[];
  days: string[];
  stages: Stage[];
  /** Set times. Usually published a week or two before the festival. */
  sets?: SetTime[];
  /** First and last day, "YYYY-MM-DD", for the countdown. `dates` stays the text people read. */
  startDate?: string;
  endDate?: string;
  /**
   * For a festival run over separate weekends (ACL, Coachella): each weekend's
   * first and last day, in order. `startDate`/`endDate` then span them all.
   */
  weekends?: { start: string; end: string }[];
  /** What the lineup says about a particular set, by artist id: "Sunset set", "Wholesome riddim set". */
  notes?: Record<string, string>;
  /**
   * Which of the festival's `days` each artist plays, by artist id, when the
   * poster says so before set times are out ("Friday", or two days for
   * someone playing twice). Set times, once out, say it too.
   */
  artistDays?: Record<string, string[]>;
  /**
   * For a festival run over several `weekends`: the one weekend (1, 2, …) an
   * artist plays, by artist id. Artists not listed play every weekend.
   */
  artistWeekends?: Record<string, number>;
};

/**
 * A festival's lineup as a source publishes it, separately from the festival
 * itself: lineups are announced in waves and set times arrive late, so a real
 * source will update this far more often than the festival's name or dates.
 * When a snapshot carries one, it replaces the festival's own lineup (and its
 * set times, when given).
 */
export type FestivalLineup = {
  festivalId: string;
  /** Artist ids in billing order. */
  artistIds: string[];
  /** Set times, once published. Leave undefined to keep the festival's own. */
  sets?: SetTime[];
  /** Days and stages that come with set times, if the source gives them. */
  days?: string[];
  stages?: Stage[];
};

/** Before set times, a festival is a lineup; after, it's a timetable. Every schedule feature works in both. */
export type FestivalPhase = 'lineup' | 'timetable';

/**
 * Real footage for a clip: a section of an official upload, played in the
 * platform's own embedded player. We only point at the video; nothing is
 * downloaded or re-hosted, and if the owner removes it the clip falls back.
 *
 * One provider today. A new provider (a native video file, another
 * platform) becomes another member of this type, with its own player behind
 * ClipPlayer and its own mapping in features/discover/media.ts.
 */
export type YouTubeClipSource = {
  provider: 'youtube';
  /** The 11-character id from the watch link (youtube.com/watch?v=<id>). */
  videoId: string;
  /** Seconds into the video where the clip starts and stops. */
  start: number;
  end: number;
  /** Who uploaded it, credited on the clip. Only official artist, festival, label or event channels. */
  channel: string;
  /** Shot vertically (an official Short). Gets a tall player; everything else is shown 16:9. */
  vertical?: boolean;
  /** A short upright crowd clip (a YouTube Short), played whole from its start. Discover spaces these out. */
  short?: boolean;
};

/**
 * A video someone shared to their Afterglow profile (a community clip). It
 * never comes from a catalogue file: only the app builds these, from shared
 * memories, and plays them with the phone's own video player.
 */
export type CommunityClipSource = {
  provider: 'community';
  /** The shared video file (https). */
  videoUrl: string;
  /** Its still (https), when there is one. */
  thumbUrl?: string;
  /** Who shared it, credited on the clip; opens their profile. */
  handle: string;
  uid: string;
  /** The shared memory's id, for reporting it. */
  sharedId: string;
  /** When it was filmed, ISO 8601. */
  capturedAt: string;
  /** Filmed upright. Gets a tall player. */
  vertical: boolean;
  /** The part that plays, when it was trimmed (seconds into the file). */
  clip?: { start: number; end: number };
  /** Playing back to back with the clip's artist. */
  withArtistIds?: string[];
};

/**
 * An artist's SoundCloud page, played in SoundCloud's own embedded player
 * (their uploads). Never in a catalogue's clips: Discover makes one card per
 * artist with a page (features/discover/soundcloud.ts), id "soundcloud:<artist id>".
 */
export type SoundCloudClipSource = { provider: 'soundcloud' } & SoundCloudProfile;

export type ClipSource = YouTubeClipSource | CommunityClipSource | SoundCloudClipSource;

export type Clip = {
  id: string;
  artistId: string;
  festivalId: string;
  title: string;
  /** Clip length in seconds. For real footage this is end minus start. */
  durationSec: number;
  /** Tempo of the set, drives the placeholder light show. */
  bpm: number;
  /** Real footage. Leave undefined to show the placeholder stage. */
  source?: ClipSource;
  /**
   * A back to back: the other artists playing (Afterglow ids), from the
   * catalogue's `"with"` or found in the title ("B2B KOMPANY"; data/b2b.ts).
   */
  withArtistIds?: string[];
};

/**
 * One club show or concert (not a festival) from the nightly EDMTrain feed,
 * listed on the artist pages of everyone on Afterglow who plays it. Only
 * what EDMTrain publishes; `link` is the event's EDMTrain page, which the
 * app opens and credits (as EDMTrain asks).
 */
export type Show = {
  /** "edm-123456" (EDMTrain's event id). */
  id: string;
  /** The day, "YYYY-MM-DD" (local to the venue). */
  date: string;
  /** The event's own name, when it has one ("Wasteland Halloween"); most club nights only have the venue. */
  name?: string;
  venue: string;
  /** "Denver, CO". Empty when the source doesn't say. */
  location: string;
  place?: { lat: number; lon: number };
  /** The event's page (https). */
  link: string;
  /** The artists on Afterglow playing it, in billing order. */
  artistIds: string[];
};

/**
 * Everything the app needs from a catalogue, in one plain object: what a
 * source delivers and what the app keeps. Order matters: festivals and
 * clips are shown in the order given.
 */
export type CatalogSnapshot = {
  artists: Artist[];
  festivals: Festival[];
  clips: Clip[];
  /** Separately published lineups; each replaces its festival's lineup. */
  lineups?: FestivalLineup[];
  similarities?: ArtistSimilarity[];
  /** Club shows and concerts from the nightly feed, soonest first. */
  shows?: Show[];
  /** Artist id -> their SoundCloud page, matched each night (an artist's own `soundcloud` link wins). */
  soundcloud?: Record<string, SoundCloudProfile>;
};

/**
 * Where a catalogue comes from. The mock source is instant; a real one would
 * fetch (and cache) the same snapshot. Nothing in the app depends on which
 * one it is.
 */
export type CatalogSource = {
  /** A name for logs and debugging, e.g. "mock". */
  name: string;
  load: () => Promise<CatalogSnapshot>;
};
