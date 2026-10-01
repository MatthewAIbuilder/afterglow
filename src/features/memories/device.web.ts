import type { MemoryFiles, PickResult } from './device';

/**
 * Memories in a browser: not yet. Keeping videos needs the phone's own
 * storage, so the website says adding videos is in the iPhone app for now,
 * and there are no files to list or tidy. The same exports as device.ts
 * (Metro picks this file for web).
 */
export type { MemoryFiles, PickedVideo, PickResult } from './device';

export const MAX_CLIP_SECONDS = 60;

export async function pickVideo(_source: 'camera' | 'library'): Promise<PickResult> {
  return { ok: false, reason: 'app-only' };
}

export async function recordedVideo(): Promise<never> {
  throw new Error('Filming is in the iPhone app for now.');
}

export const deviceMemoryFiles: MemoryFiles = {
  async keep() {
    throw new Error('Memories are in the iPhone app for now.');
  },
  async remove() {},
  uriOf: (name) => name,
  list: () => [],
  async saveToPhotos() {
    return false;
  },
};
