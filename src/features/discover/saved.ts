import type { Clip } from '../../data/models';

/**
 * Your clips: the ones you saved to watch again, and the ones you liked.
 * Pure. Catalogue order, so a clip keeps its place in the list; clips no
 * longer in the catalogue simply drop out. A clip you both saved and liked
 * is listed once, under Saved.
 */
type Reactions = Record<string, { saved: boolean; liked: boolean } | undefined>;

export type YourClips = { saved: Clip[]; liked: Clip[] };

export function savedClips(clips: Clip[], reactions: Reactions) {
  return clips.filter((c) => reactions[c.id]?.saved);
}

export function yourClips(clips: Clip[], reactions: Reactions): YourClips {
  return {
    saved: savedClips(clips, reactions),
    liked: clips.filter((c) => reactions[c.id]?.liked && !reactions[c.id]?.saved),
  };
}

/** How many clips are yours, each counted once. */
export const yourClipCount = (mine: YourClips) => mine.saved.length + mine.liked.length;

/** Clip ids in each section when the page opened. */
export type Opened = { saved: ReadonlySet<string>; liked: ReadonlySet<string> };

export const openedWith = (mine: YourClips): Opened => ({
  saved: new Set(mine.saved.map((c) => c.id)),
  liked: new Set(mine.liked.map((c) => c.id)),
});

/**
 * What the page lists: what was in each section when you opened it, plus
 * anything added since. Unsaving or unliking there keeps the row (shown as
 * off) so a slip of the thumb is one tap to undo. A clip never shows twice.
 */
export function listedClips(clips: Clip[], opened: Opened, reactions: Reactions): YourClips {
  const saved = clips.filter((c) => opened.saved.has(c.id) || reactions[c.id]?.saved);
  const inSaved = new Set(saved.map((c) => c.id));
  const liked = clips.filter(
    (c) => !inSaved.has(c.id) && (opened.liked.has(c.id) || (reactions[c.id]?.liked && !reactions[c.id]?.saved)),
  );
  return { saved, liked };
}
