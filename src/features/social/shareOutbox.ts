/**
 * Videos waiting to be shared to Discover: kept on the phone (AsyncStorage
 * `shareOutbox.v1`, memory ids only, never the video) and sent oldest first
 * whenever there's signal. Per account: each item says whose it is, and only
 * that account sends it. Pure, so the rules are tested apart from storage.
 */
export type ShareItem = {
  /** The memory on this phone. */
  memoryId: string;
  /** Whose profile it goes on. */
  uid: string;
  /** When you asked to share it (ms): the order it's sent in. */
  at: number;
  /** Tries that found no signal. */
  tries: number;
};

/** At most this many waiting (oldest kept first: they were asked for first). */
export const SHARE_OUTBOX_MAX = 50;

/** Add a video (once per account), in the order it was asked for. */
export function queueShare(list: ShareItem[], item: Omit<ShareItem, 'tries'>): ShareItem[] {
  if (list.some((i) => i.memoryId === item.memoryId && i.uid === item.uid)) return list;
  return [...list, { ...item, tries: 0 }].sort((a, b) => a.at - b.at).slice(0, SHARE_OUTBOX_MAX);
}

/** It went through, was refused, or isn't needed any more. */
export function unqueueShare(list: ShareItem[], memoryId: string, uid?: string): ShareItem[] {
  const next = list.filter((i) => !(i.memoryId === memoryId && (uid === undefined || i.uid === uid)));
  return next.length === list.length ? list : next;
}

/** One more try that found no signal. */
export function shareTried(list: ShareItem[], memoryId: string, uid: string): ShareItem[] {
  return list.map((i) => (i.memoryId === memoryId && i.uid === uid ? { ...i, tries: i.tries + 1 } : i));
}

/** This account's videos, oldest first. */
export const sharesOf = (list: ShareItem[], uid: string | undefined) => (uid ? list.filter((i) => i.uid === uid) : []);

/** The next try after this many with no signal: 15 s, doubling, at most 2 minutes. */
export const shareRetryDelay = (tries: number) => Math.min(120_000, 15_000 * 2 ** Math.max(0, tries));

/** A saved outbox read back: anything unreadable dropped. */
export function cleanShareOutbox(raw: unknown): ShareItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ShareItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.memoryId !== 'string' || !o.memoryId || typeof o.uid !== 'string' || !o.uid) continue;
    if (typeof o.at !== 'number' || !Number.isFinite(o.at)) continue;
    const tries = typeof o.tries === 'number' && Number.isFinite(o.tries) && o.tries >= 0 ? Math.floor(o.tries) : 0;
    if (out.some((i) => i.memoryId === o.memoryId && i.uid === o.uid)) continue;
    out.push({ memoryId: o.memoryId, uid: o.uid, at: o.at, tries });
  }
  return out.sort((a, b) => a.at - b.at).slice(0, SHARE_OUTBOX_MAX);
}
