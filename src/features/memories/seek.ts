import type { VideoPlayer } from 'expo-video';

/** Move a player to a time (kept out of components, where the compiler treats the player as read-only). */
export const seekTo = (p: VideoPlayer, seconds: number) => {
  p.currentTime = seconds;
};

/** How often a player reports where it is, in seconds. */
export const reportEvery = (p: VideoPlayer, seconds: number) => {
  p.timeUpdateEventInterval = seconds;
};
