import type { PickedVideo } from './device';

/**
 * Drafts: videos filmed with the website's camera, kept in this browser until
 * they're shared or deleted, so going back (or closing the page) never loses
 * one. Only the website has them (`webDrafts.web.ts`): the app keeps every
 * recording in Memories the moment it stops, so here there's nothing to do.
 */
export type VideoDraft = {
  id: string;
  durationSec: number;
  width?: number;
  height?: number;
  bytes: number;
  /** When it was filmed (ms). */
  at: number;
  /** Who was being filmed, from their page ("Film the set"), passed on to the tagging sheet. */
  params?: Record<string, string>;
};

export const draftsAvailable = false;

export async function saveDraft(_blob: Blob, _meta: Omit<VideoDraft, 'id' | 'bytes'>): Promise<string | undefined> {
  return undefined;
}
export async function listDrafts(): Promise<VideoDraft[]> {
  return [];
}
/** A draft as a video for the tagging sheet (a link to it in this page). */
export async function draftVideo(_id: string): Promise<PickedVideo | undefined> {
  return undefined;
}
export async function removeDraft(_id: string): Promise<void> {}
/** Listen for drafts being added or removed. */
export function onDraftsChange(_fn: () => void): () => void {
  return () => {};
}
/** Save a video to the phone: the share sheet's Save Video where there is one, else a download. */
export async function saveVideoToPhone(_uri: string, _name: string): Promise<'saved' | 'cancelled' | 'failed'> {
  return 'failed';
}
