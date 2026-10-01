import type { SoundTag } from '../../data/models';

/**
 * Social profiles: what other Afterglow people can see about you. Plain
 * data, the same shape in the app and in the database.
 *
 * PUBLIC to anyone signed in to Afterglow: your handle, name, bio and photo,
 * and only what you switch on: the festivals you're going to, your top
 * sounds, and each memory you choose to share. Everything else (your taste,
 * ratings, reactions, music library, unshared memories, where you filmed)
 * stays private on your phone.
 */
export type SocialUser = { uid: string; email?: string };

export type Profile = {
  uid: string;
  /** Unique, lowercase: letters, numbers, dots and underscores. */
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  /** Festivals you're going to, shown only when you switch it on. */
  festivals: string[];
  /** Your top sounds, shown only when you switch it on. */
  sounds: SoundTag[];
  /** Your switches, so the published lists can follow your plans without re-saving. */
  showFestivals: boolean;
  showSound: boolean;
  createdAt: string;
  updatedAt: string;
};

/** What you edit. `showFestivals` / `showSound` decide whether those lists are published at all. */
export type ProfileInput = {
  handle: string;
  displayName: string;
  bio: string;
  showFestivals: boolean;
  showSound: boolean;
};

/** A memory you shared, as others see it. Where you filmed it is never included. */
export type SharedMemory = {
  id: string;
  uid: string;
  handle: string;
  videoUrl: string;
  thumbUrl?: string;
  festivalId?: string;
  night?: string;
  artistId?: string;
  capturedAt: string;
  durationSec?: number;
  /** The video's size, so upright clips get a tall player. */
  width?: number;
  height?: number;
  createdAt: string;
};

export type ReportReason = 'offensive' | 'harassment' | 'spam' | 'not-theirs' | 'other';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'offensive', label: 'Offensive or explicit' },
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'spam', label: 'Spam or misleading' },
  { key: 'not-theirs', label: 'Not their video' },
  { key: 'other', label: 'Something else' },
];

/** Something that happened to you: someone followed you, or liked a video you shared. */
export type Activity =
  | { kind: 'follow'; id: string; from: string; createdAt: string }
  | { kind: 'like'; id: string; from: string; memoryId: string; createdAt: string };

/**
 * A festival crew: a few friends planning one festival together. Anyone
 * signed in who has the crew's link can see its name and join (the id is the
 * invite); only members see each other's picks.
 */
export type Crew = {
  id: string;
  festivalId: string;
  name: string;
  /** Who started it (or was handed it when they left). Can rename it and remove people. */
  owner: string;
  /** Members' uids in the order they joined, the owner among them. At most CREW_MAX. */
  members: string[];
  createdAt: string;
};

/** One member's starred sets at the crew's festival, shared with the crew only. */
export type CrewPicks = { uid: string; artists: string[]; updatedAt: string };

/** A crew holds at most this many people. */
export const CREW_MAX = 12;
/** Crew names are at most this long. */
export const CREW_NAME_MAX = 40;
/** At most this many picks are shared per member. */
export const CREW_PICKS_MAX = 100;

/**
 * A crew update: where you are and what you're seeing, for your crew only.
 * From a video (filmed then) or a quick check-in (tapped then).
 *
 * Two times, kept apart on purpose. `at` is when it happened on your phone:
 * when the video was filmed or the check-in tapped. That's the time the crew
 * sees, and the one that decides which update is newest. `sentAt` is when it
 * reached the crew, stamped by the server; festival signal can hold an update
 * back for hours, and the app says so instead of passing it off as new.
 */
export type CrewUpdate = {
  id: string;
  crewId: string;
  uid: string;
  kind: 'video' | 'checkin';
  /** When it happened on the phone (ISO 8601). */
  at: string;
  /** When it reached the crew (ISO 8601, from the server). */
  sentAt: string;
  festivalId: string;
  artistId?: string;
  stage?: string;
  /** A check-in's words ("Meet at our spot"), at most CREW_NOTE_MAX. */
  note?: string;
  videoUrl?: string;
  thumbUrl?: string;
  /** When the video was also shared to Discover: that copy's id. */
  sharedId?: string;
  durationSec?: number;
  width?: number;
  height?: number;
};

/** What you send: the id is made on your phone, so sending again after a dropped connection never doubles it. */
export type CrewUpdateInput = Omit<CrewUpdate, 'crewId' | 'uid' | 'sentAt' | 'videoUrl' | 'thumbUrl'> & {
  /** A video already shared to Discover: the crew update points at that copy. */
  videoUrl?: string;
  thumbUrl?: string;
  /** Otherwise the files on this phone, uploaded for the crew only. */
  videoUri?: string;
  thumbUri?: string;
};

/** Check-in words are at most this long. */
export const CREW_NOTE_MAX = 80;
/** Stage names in an update are at most this long. */
export const CREW_STAGE_MAX = 60;
