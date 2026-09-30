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
  /** The festival day ("Friday"), when known. */
  night?: string;
  artistId?: string;
  /** Once shared to your profile: the shared copy's id, and whose profile it's on. */
  sharedId?: string;
  sharedBy?: string;
};

/** What the tagging sheet saves onto a memory. */
export type MemoryTagInput = Pick<Memory, 'festivalId' | 'night' | 'artistId'>;
