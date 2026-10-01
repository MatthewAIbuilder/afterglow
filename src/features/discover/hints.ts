/**
 * First-time tips in Discover, one at a time, each gone for good once you've
 * done the thing it teaches. Pure: what you've done is passed in.
 */
export type Hint = 'swipe' | 'like' | 'hold';

export const HINTS: readonly Hint[] = ['swipe', 'like', 'hold'];

/** Short, beside its icon, so it fits next to the festival name. */
export const HINT_COPY: Record<Hint, string> = {
  swipe: 'Swipe up',
  like: 'Double-tap',
  hold: 'Swipe right to film',
};

/** The whole tip, for screen readers. */
export const HINT_SPOKEN: Record<Hint, string> = {
  swipe: 'Swipe up for the next clip',
  like: 'Double-tap a clip to like it',
  hold: 'Swipe right, or tap the camera button, to film your own video',
};

/** The tip to show now: the first one you haven't done yet, if any. */
export function currentHint(done: ReadonlySet<Hint>): Hint | undefined {
  return HINTS.find((h) => !done.has(h));
}

/**
 * Tips you've already shown you know, from what the app remembers: someone
 * who has had more than one clip on screen has swiped, and someone who has
 * liked or saved a clip knows how to react, and someone with a memory knows
 * how to add one. So people who used the app before the tips existed never
 * see them.
 */
export function alreadyKnown(
  seenClips: number,
  reactions: Record<string, { liked: boolean; saved: boolean } | undefined>,
  memories = 0,
): Hint[] {
  const known: Hint[] = [];
  if (seenClips > 1) known.push('swipe');
  if (Object.values(reactions).some((r) => r?.liked || r?.saved)) known.push('like');
  if (memories > 0) known.push('hold');
  return known;
}

/** Stored tips, cleaned: anything that isn't a known tip is dropped. */
export function cleanHints(raw: unknown): Hint[] {
  if (!Array.isArray(raw)) return [];
  return HINTS.filter((h) => raw.includes(h));
}
