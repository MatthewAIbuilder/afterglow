/**
 * Clips whose video wouldn't play on this phone in this session (the embed
 * refused, the file was gone). Discover leaves them out of its next ranking:
 * a clip with nothing to watch doesn't belong in the feed (the user,
 * 2026-10-19). Kept in memory only; a new session tries them again.
 */
const failed = new Set<string>();

export const markUnplayable = (clipId: string) => {
  failed.add(clipId);
};
export const isUnplayable = (clipId: string) => failed.has(clipId);
/** For tests. */
export const forgetUnplayable = () => failed.clear();
