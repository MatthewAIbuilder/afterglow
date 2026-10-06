
/**
 * How many comments a clip in Discover has, for the speech bubble in its
 * rail: a shared video's (`video`) or a catalogue clip's (`clip`). Read once
 * per card that's on screen or next to it, kept for a while, and changed
 * straight away when you post or delete one in the comments sheet. The
 * store is plain (tests reset it); `useCommentCount` reads it.
 */
export type CommentTarget = { kind: 'video' | 'clip'; id: string };

/** Counts stay fresh this long. */
const FRESH_MS = 5 * 60_000;
const cache = new Map<string, { at: number; count: number }>();
const asking = new Set<string>();
const listeners = new Set<() => void>();
const changed = () => {
  listeners.forEach((l) => l());
};
export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const keyOf = (t: CommentTarget) => `${t.kind}:${t.id}`;

/** The count kept for this clip, or undefined when it hasn't been read. */
export const knownCommentCount = (target: CommentTarget) => cache.get(keyOf(target))?.count;

/**
 * Whether to read this count now (not kept, or kept too long, and not already being read). Marks it as
 * being read: hand the answer to `rememberCommentCount`, and call `doneAsking` either way.
 */
export function shouldAsk(target: CommentTarget): boolean {
  const key = keyOf(target);
  const hit = cache.get(key);
  if ((hit && Date.now() - hit.at < FRESH_MS) || asking.has(key)) return false;
  asking.add(key);
  return true;
}
export const doneAsking = (target: CommentTarget) => void asking.delete(keyOf(target));

/** Set a count you know (after reading every comment, or posting one). */
export function rememberCommentCount(target: CommentTarget, count: number) {
  cache.set(keyOf(target), { at: Date.now(), count: Math.max(0, count) });
  changed();
}

/** One more or one fewer, when it's been read. */
export function bumpCommentCount(target: CommentTarget, by: number) {
  const hit = cache.get(keyOf(target));
  if (!hit) return;
  cache.set(keyOf(target), { at: hit.at, count: Math.max(0, hit.count + by) });
  changed();
}

/** For tests: forget every count. */
export function forgetCommentCounts() {
  cache.clear();
  asking.clear();
  changed();
}

