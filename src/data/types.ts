/** Sound regions used to place artists on the map. Extend freely. */
export type SoundTag = 'melodic-bass' | 'dubstep' | 'riddim' | 'trap' | 'techno' | 'house';

export const SOUND_LABEL: Record<SoundTag, string> = {
  'melodic-bass': 'Melodic bass',
  dubstep: 'Dubstep',
  riddim: 'Riddim',
  trap: 'Trap',
  techno: 'Techno',
  house: 'House',
};

export type Artist = {
  id: string;
  name: string;
  /** Remote image. Leave undefined to show the gradient monogram. */
  imageUrl?: string;
  /** How much of each sound this artist carries, 0 to 1. */
  sound: Partial<Record<SoundTag, number>>;
};

/** Predicted affinity per artist, 0 to 1. Later this comes from the taste engine. */
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
};

export type Clip = {
  id: string;
  artistId: string;
  festivalId: string;
  title: string;
  durationSec: number;
  /** Tempo of the set, drives the placeholder light show. */
  bpm: number;
  /** Real footage later. Leave undefined to show the placeholder stage. */
  videoUrl?: string;
};
