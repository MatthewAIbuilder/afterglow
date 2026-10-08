import type { PickedVideo } from './device';
import type { VideoDraft } from './webDrafts';

/**
 * Drafts on the website: each video filmed with the page's camera is kept in
 * this browser's own storage (IndexedDB, which holds files) the moment it
 * stops, with when it was filmed and its size, until it's shared to Discover
 * or deleted. Nothing here leaves the browser. Safari may clear a site's
 * storage it hasn't seen in weeks, so drafts are for finishing later, not for
 * keeping forever (Save to phone keeps a copy in Photos).
 */
export type { VideoDraft } from './webDrafts';

export const draftsAvailable = typeof indexedDB !== 'undefined';

const DB = 'afterglowDrafts';
const STORE = 'drafts';
type Row = VideoDraft & { blob: Blob };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function run<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());
export function onDraftsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function saveDraft(blob: Blob, meta: Omit<VideoDraft, 'id' | 'bytes'>): Promise<string | undefined> {
  if (!draftsAvailable) return undefined;
  const id = `d${meta.at.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  try {
    await run('readwrite', (s) => s.put({ ...meta, id, bytes: blob.size, blob } satisfies Row));
    changed();
    return id;
  } catch {
    // Out of room (or private browsing): the video still goes on to the tagging sheet, just not kept.
    return undefined;
  }
}

export async function listDrafts(): Promise<VideoDraft[]> {
  if (!draftsAvailable) return [];
  try {
    const rows = await run('readonly', (s) => s.getAll() as IDBRequest<Row[]>);
    return rows.map(({ blob: _blob, ...d }) => d).sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export async function draftVideo(id: string): Promise<PickedVideo | undefined> {
  if (!draftsAvailable) return undefined;
  try {
    const row = await run('readonly', (s) => s.get(id) as IDBRequest<Row | undefined>);
    if (!row) return undefined;
    return {
      uri: URL.createObjectURL(row.blob),
      source: 'camera',
      durationSec: row.durationSec,
      ...(row.width && row.height ? { width: row.width, height: row.height } : {}),
      bytes: row.bytes,
      moment: { when: new Date(row.at) },
      keptBySharing: true,
      draftId: row.id,
    };
  } catch {
    return undefined;
  }
}

export async function removeDraft(id: string): Promise<void> {
  if (!draftsAvailable) return;
  try {
    await run('readwrite', (s) => s.delete(id));
  } catch {
    // Already gone, or storage is unavailable: nothing more to do.
  }
  changed();
}

export async function saveVideoToPhone(uri: string, name: string): Promise<'saved' | 'cancelled' | 'failed'> {
  try {
    const blob = await (await fetch(uri)).blob();
    const file = new File([blob], name, { type: blob.type || 'video/mp4' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    // On an iPhone the share sheet has Save Video, which puts it in Photos.
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file] });
        return 'saved';
      } catch (e) {
        return (e as { name?: string })?.name === 'AbortError' ? 'cancelled' : 'failed';
      }
    }
    // Elsewhere a download (to Files on an iPhone, Downloads on a computer).
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    return 'saved';
  } catch {
    return 'failed';
  }
}
