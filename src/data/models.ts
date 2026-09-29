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
  /** How much of each sound this artist carries, 0 to 1. */
  sound: Partial<Record<SoundTag, number>>;
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
  /** Link to the official lineup poster, if you have one. Tap to view full screen. */
  posterImageUrl?: string;
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
};

export type ClipSource = YouTubeClipSource;

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
