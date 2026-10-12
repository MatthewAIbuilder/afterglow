import type { SharedMemory } from '../social/models';
import { MAX_SHARE_BYTES } from '../social/service';
import type { Moment } from './guess';
import type { Memory } from './models';

/**
 * Posting a video from the website, pure: which files a browser may choose
 * (an iPhone gives `.mov` as video/quicktime, or `.mp4`), the same limits as
 * the app (a minute long, under the upload cap), and what the website shows
 * as your moments (the videos you shared, from the server, since a browser
 * keeps no files of its own). The DOM side is in device.web.ts.
 */

/** The same cap as the app's picker and camera (device.ts `MAX_CLIP_SECONDS`): what plays, once trimmed. */
export const WEB_MAX_CLIP_SECONDS = 60;
/** A longer video can be chosen and trimmed to WEB_MAX_CLIP_SECONDS on the tagging sheet, up to this long. */
export const WEB_MAX_SOURCE_SECONDS = 600;
/**
 * The biggest file the website takes. Only the chosen part is uploaded (cut out in the page, `cutPart.web.ts`),
 * and it has to fit a share's upload cap (MAX_SHARE_BYTES, as storage.rules), so the file itself can be far bigger.
 */
export const WEB_MAX_VIDEO_BYTES = 4 * 1024 * 1024 * 1024;
/** A share's upload cap, which the part that plays has to fit. */
export const WEB_MAX_PART_BYTES = MAX_SHARE_BYTES;

export type WebVideoFormat = 'video/mp4' | 'video/quicktime' | 'video/x-m4v';

/** A video's format from its type, or from its name when the browser gives no type. Anything else (WebM, AVI…) can't be shared. */
export function webVideoFormat(type: string | undefined, name: string | undefined): WebVideoFormat | undefined {
  const t = (type ?? '').toLowerCase().split(';')[0].trim();
  if (t === 'video/mp4' || t === 'video/quicktime' || t === 'video/x-m4v') return t;
  if (t && t !== 'application/octet-stream') return undefined;
  const ext = (name ?? '').split('.').pop()?.toLowerCase();
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov' || ext === 'qt') return 'video/quicktime';
  if (ext === 'm4v') return 'video/x-m4v';
  return undefined;
}

export type WebFileCheck = { ok: true; format: WebVideoFormat } | { ok: false; reason: 'wrong-type' | 'too-large' | 'failed' };

/** Whether a chosen file can become a post at all, before reading it. */
export function checkWebFile(f: { type?: string; name?: string; size: number }): WebFileCheck {
  const format = webVideoFormat(f.type, f.name);
  if (!format) return { ok: false, reason: 'wrong-type' };
  if (!(f.size > 0)) return { ok: false, reason: 'failed' };
  // storage.rules take files under the cap.
  if (f.size >= WEB_MAX_VIDEO_BYTES) return { ok: false, reason: 'too-large' };
  return { ok: true, format };
}

/** What an off-screen <video> read from the file. */
export type WebVideoMeta = { duration: number; width: number; height: number };

export type WebMetaCheck = { ok: true; durationSec: number; width?: number; height?: number } | { ok: false; reason: 'too-long' | 'failed' };

/** Up to WEB_MAX_SOURCE_SECONDS (longer ones are trimmed on the tagging sheet); a file the browser can't read is refused. */
export function checkWebMeta(meta: WebVideoMeta | undefined): WebMetaCheck {
  if (!meta || !Number.isFinite(meta.duration) || meta.duration <= 0) return { ok: false, reason: 'failed' };
  const durationSec = Math.max(1, Math.round(meta.duration));
  if (durationSec > WEB_MAX_SOURCE_SECONDS + 1) return { ok: false, reason: 'too-long' };
  const sized = meta.width > 0 && meta.height > 0;
  return { ok: true, durationSec, width: sized ? Math.round(meta.width) : undefined, height: sized ? Math.round(meta.height) : undefined };
}

/** When a chosen file was made, if the browser says (a fresh recording says now). */
export function webMoment(lastModified: number | undefined, now: number): Moment {
  return { when: new Date(lastModified && Number.isFinite(lastModified) && lastModified > 0 && lastModified <= now + 60_000 ? lastModified : now) };
}

/** Is this memory a video on the server (a website share) rather than a file kept on the phone? */
export const onServer = (m: Pick<Memory, 'file'>) => /^https:\/\//.test(m.file);

/** A video you shared, as one of your moments on the website (it opens as the shared video). */
export function sharedAsMemory(s: SharedMemory): Memory {
  return {
    id: s.id,
    file: s.videoUrl,
    thumb: s.thumbUrl,
    capturedAt: s.capturedAt,
    addedAt: s.createdAt,
    durationSec: s.durationSec,
    width: s.width,
    height: s.height,
    festivalId: s.festivalId,
    night: s.night,
    past: s.past,
    show: s.show,
    artistId: s.artistId,
    withArtistIds: s.withArtistIds,
    ...(s.artistName ? { artistName: s.artistName } : {}),
    clip: s.clip,
    sharedId: s.id,
    sharedBy: s.uid,
  };
}

/**
 * Your moments on the website: the videos you shared (from the server), and
 * any still uploading from this page (kept only until it's shared). One per
 * video: once the server has it, the page's own copy steps aside.
 */
export function webMoments(local: readonly Memory[], shared: readonly SharedMemory[]): Memory[] {
  const ids = new Set(shared.map((s) => s.id));
  return [...shared.map(sharedAsMemory), ...local.filter((m) => !(m.sharedId && ids.has(m.sharedId)))];
}

/**
 * Your moments in the app: the videos kept on this phone, plus the ones you
 * shared that this phone doesn't have (posted from the website, another
 * phone, or before a reinstall), which open as the shared video. A video kept
 * here wins over its shared copy.
 */
export function appMoments(local: readonly Memory[], shared: readonly SharedMemory[]): Memory[] {
  const kept = new Set(local.flatMap((m) => (m.sharedId ? [m.sharedId] : [])));
  return [...local, ...shared.filter((s) => !kept.has(s.id)).map(sharedAsMemory)];
}

/** A file the browser handed over (a File, in a browser). */
export type WebFile = { type?: string; name?: string; size: number; lastModified?: number };

export type WebPickDeps<F extends WebFile> = {
  /** Open the browser's chooser (Photos, Files or the camera on an iPhone); undefined when cancelled. */
  choose: (source: 'camera' | 'library') => Promise<F | undefined>;
  /** Read length and size from an off-screen <video>; undefined when it can't be read. */
  readMeta: (url: string) => Promise<WebVideoMeta | undefined>;
  objectUrl: (file: F) => string;
  revoke: (url: string) => void;
  now: () => number;
};

export type WebPickResult =
  | { ok: true; video: { uri: string; source: 'camera' | 'library'; durationSec: number; width?: number; height?: number; bytes: number; moment: Moment; format: WebVideoFormat } }
  | { ok: false; reason: 'cancelled' | 'too-long' | 'too-large' | 'wrong-type' | 'failed' };

/** Choosing a video on the website: the same limits as the app, checked before anything is kept or uploaded. */
export async function pickWebVideo<F extends WebFile>(source: 'camera' | 'library', deps: WebPickDeps<F>): Promise<WebPickResult> {
  let file: F | undefined;
  try {
    file = await deps.choose(source);
  } catch {
    return { ok: false, reason: 'failed' };
  }
  if (!file) return { ok: false, reason: 'cancelled' };
  const fileCheck = checkWebFile(file);
  if (!fileCheck.ok) return fileCheck;
  let url: string;
  try {
    url = deps.objectUrl(file);
  } catch {
    return { ok: false, reason: 'failed' };
  }
  const meta = await deps.readMeta(url).catch(() => undefined);
  const metaCheck = checkWebMeta(meta);
  if (!metaCheck.ok) {
    deps.revoke(url);
    return metaCheck;
  }
  return {
    ok: true,
    video: {
      uri: url,
      source,
      durationSec: metaCheck.durationSec,
      width: metaCheck.width,
      height: metaCheck.height,
      bytes: file.size,
      moment: source === 'camera' ? { when: new Date(deps.now()) } : webMoment(file.lastModified, deps.now()),
      format: fileCheck.format,
    },
  };
}
