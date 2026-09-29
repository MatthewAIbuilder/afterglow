import type { Clip } from '../../data/models';

/**
 * The clips you saved to watch again. Pure. Catalogue order, so a clip keeps
 * its place in the list; clips no longer in the catalogue simply drop out.
 */
export function savedClips(clips: Clip[], reactions: Record<string, { saved: boolean } | undefined>) {
  return clips.filter((c) => reactions[c.id]?.saved);
}

/**
 * What the Saved page lists: what was saved when you opened it, plus anything
 * saved since. Unsaving there keeps the row (shown as unsaved) so a slip of
 * the thumb is one tap to undo.
 */
export function listedClips(clips: Clip[], openedWith: ReadonlySet<string>, reactions: Record<string, { saved: boolean } | undefined>) {
  return clips.filter((c) => openedWith.has(c.id) || reactions[c.id]?.saved);
}
