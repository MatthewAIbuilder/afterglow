import type { PastEvent } from './past';
import type { ShowTag } from './show';
import type { ClipWindow } from './trim';
/**
 * Memories: your own videos from festivals, kept on this phone and tagged
 * with where they're from (festival, night, artist). Plain data, so the list
 * can be saved as JSON and a memory shared to your profile unchanged.
 *
 * PRIVACY. A memory is private: it lives in Afterglow's own storage on this
 * phone and nobody else sees it unless you share it to your profile. Only a
 * city and region are kept from where it was filmed, never coordinates.
 */

export type Memory = {
  id: string;
  /** The video's file name in Afterglow's memories folder (a name, not a path: the folder moves between app updates). */
  file: string;
  /** Its still, in the same folder, when one could be made. */
  thumb?: string;
  /** When it was filmed (ISO 8601), from the video or the moment it was recorded. */
  capturedAt: string;
  /** When it was added to Memories. */
  addedAt: string;
  durationSec?: number;
  width?: number;
  height?: number;
  /** Where it was filmed, as a place name only. */
  place?: { city?: string; region?: string };
  festivalId?: string;
  /** A festival from before Afterglow knew it ("EDC Orlando 2024"), instead of `festivalId`. */
  past?: PastEvent;
  /** A one-night show (a club night or concert), instead of a festival. */
  show?: ShowTag;
  /** The festival day ("Friday"), when known. */
  night?: string;
  artistId?: string;
  /** Playing back to back with `artistId`: the others, in order. */
  withArtistIds?: string[];
  /** The part that plays, when the video was trimmed (seconds into the file). */
  clip?: ClipWindow;
  /** Once shared to your profile: the shared copy's id, and whose profile it's on. */
  sharedId?: string;
  sharedBy?: string;
};

/** What the tagging sheet saves onto a memory. */
export type MemoryTagInput = Pick<Memory, 'festivalId' | 'night' | 'artistId' | 'withArtistIds' | 'past' | 'show' | 'clip'>;
