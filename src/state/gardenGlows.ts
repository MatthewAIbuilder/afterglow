/** A glow left on a garden: who (their uid) and when. */
export type GardenGlow = { from: string; at: string };

/**
 * Glows on your garden as last read, per account (features/sprouts/
 * useGardenGlows.ts): so a count shows at once next time, before the fresh
 * read lands. Kept in memory only.
 */
export const lastGlows = new Map<string, GardenGlow[]>();

/** For tests and account switches: forget what was read. */
export function forgetGardenGlows() {
  lastGlows.clear();
}
