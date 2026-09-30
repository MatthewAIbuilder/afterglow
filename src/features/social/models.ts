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
