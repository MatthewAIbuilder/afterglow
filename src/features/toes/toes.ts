/**
 * One very special person on Afterglow gets toes. Hidden ones, everywhere,
 * blended into the night: in the sky, among the stars on My Sound, peeking
 * over the tab bar, orbiting their photo. Nobody else ever sees a single toe.
 * Pure, so it can be tested.
 */

/** Whose app has toes (their Afterglow account). */
export const TOE_FRIENDS: readonly string[] = ['QdMqoH4PeEfvkBmiKAzdnWyBUlL2'];

/** Whether this signed-in account gets the toes. */
export function hasToes(uid: string | null | undefined): boolean {
  return !!uid && TOE_FRIENDS.includes(uid);
}

export type ToeStar = { x: number; y: number; r: number };

/**
 * A footprint drawn in stars: five toes from the big one down to the little
 * one, over the ball and heel of a foot. Centred on (cx, cy), `size` tall.
 */
export function toeConstellation(cx: number, cy: number, size: number): { toes: ToeStar[]; sole: ToeStar[] } {
  const u = size / 10;
  const toes: ToeStar[] = [
    { x: -1.9, y: -4.2, r: 0.62 },
    { x: -0.5, y: -4.6, r: 0.46 },
    { x: 0.75, y: -4.35, r: 0.4 },
    { x: 1.8, y: -3.75, r: 0.34 },
    { x: 2.6, y: -2.9, r: 0.28 },
  ].map((t) => ({ x: cx + t.x * u, y: cy + t.y * u, r: t.r * u }));
  const sole: ToeStar[] = [
    [-2.2, -2.4], [-0.6, -2.9], [1.0, -2.6], [2.3, -1.6],
    [2.4, 0.2], [1.9, 2.0], [1.6, 3.6], [0.5, 4.7],
    [-0.9, 4.6], [-1.7, 3.4], [-1.6, 1.6], [-2.0, 0],
  ].map(([x, y]) => ({ x: cx + x * u, y: cy + y * u, r: 0.09 * u }));
  return { toes, sole };
}
