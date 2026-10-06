import type { MemoryFiles, PickResult } from './device';
import { pickWebVideo, WEB_MAX_CLIP_SECONDS, type WebVideoMeta } from './webVideo';

/**
 * Memories in a browser. Choosing a video opens the browser's own chooser (a
 * file input: on an iPhone, Photos, Take Video or Files), checks it against
 * the app's limits (a minute long, under the upload cap, MP4 or MOV) using an
 * off-screen <video>, and hands the tagging sheet a link to the file in this
 * page. A browser keeps no files of its own, so a video lives here only until
 * it's shared to Discover (then it's on the server, and your moments come
 * from there); nothing is uploaded unless you share it. Filming with
 * Afterglow's own camera stays in the app. The same exports as device.ts
 * (Metro picks this file for web).
 */
export type { MemoryFiles, PickedVideo, PickResult } from './device';

export const MAX_CLIP_SECONDS = WEB_MAX_CLIP_SECONDS;

/** Waits this long for the browser to read a video's length or a frame before giving up on it. */
const READ_TIMEOUT_MS = 12_000;

const hasDom = () => typeof document !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

/**
 * The browser's file chooser. It must open within the tap that asked for it
 * (Safari ignores it otherwise), so the input is made and clicked at once.
 */
function chooseFile(source: 'camera' | 'library'): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    if (source === 'camera') input.setAttribute('capture', 'environment');
    input.style.position = 'fixed';
    input.style.left = '-1000px';
    input.style.opacity = '0';
    let done = false;
    const finish = (f: File | undefined) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(f);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? undefined));
    input.addEventListener('cancel', () => finish(undefined));
    document.body.appendChild(input);
    input.click();
  });
}

/** A <video> that's never shown, muted and inline (so an iPhone loads it without going full screen). */
function offscreenVideo(url: string, preload: 'metadata' | 'auto'): HTMLVideoElement {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.preload = preload;
  v.src = url;
  return v;
}

/** Waits for one of a video's events; false on an error or after the timeout. */
function waitFor(v: HTMLVideoElement, event: string, ms = READ_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    const t = setTimeout(() => end(false), ms);
    const ok = () => end(true);
    const bad = () => end(false);
    function end(r: boolean) {
      clearTimeout(t);
      v.removeEventListener(event, ok);
      v.removeEventListener('error', bad);
      resolve(r);
    }
    v.addEventListener(event, ok);
    v.addEventListener('error', bad);
  });
}

/** Length and size from the file itself (the browser turns an iPhone's sideways-stored video upright). */
async function readMeta(url: string): Promise<WebVideoMeta | undefined> {
  const v = offscreenVideo(url, 'metadata');
  const loaded = waitFor(v, 'loadedmetadata');
  v.load();
  const ok = await loaded;
  const meta = ok ? { duration: v.duration, width: v.videoWidth, height: v.videoHeight } : undefined;
  v.removeAttribute('src');
  v.load();
  return meta;
}

/** A still from about a second in, as a JPEG, like the phone makes; undefined when the browser won't draw one. */
async function posterFrame(url: string): Promise<Blob | undefined> {
  const v = offscreenVideo(url, 'auto');
  try {
    const loaded = waitFor(v, 'loadeddata');
    v.load();
    // An iPhone loads a frame only once it plays (muted and inline, which needs no tap); it's paused at once.
    void Promise.resolve(v.play())
      .then(() => v.pause())
      .catch(() => {});
    if (!(await loaded)) return undefined;
    v.pause();
    const seeked = waitFor(v, 'seeked');
    v.currentTime = Math.min(1, (v.duration || 2) / 2);
    if (!(await seeked)) return undefined;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (!w || !h) return undefined;
    const scale = Math.min(1, 720 / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | undefined>((resolve) => canvas.toBlob((b) => resolve(b ?? undefined), 'image/jpeg', 0.75));
  } catch {
    return undefined;
  } finally {
    v.removeAttribute('src');
    v.load();
  }
}

export async function pickVideo(source: 'camera' | 'library'): Promise<PickResult> {
  if (!hasDom()) return { ok: false, reason: 'app-only' };
  const r = await pickWebVideo<File>(source, {
    choose: chooseFile,
    readMeta,
    objectUrl: (f) => URL.createObjectURL(f),
    revoke: (u) => URL.revokeObjectURL(u),
    now: () => Date.now(),
  });
  if (!r.ok) return r;
  const { format: _format, ...video } = r.video;
  return { ok: true, video: { ...video, keptBySharing: true } };
}

export async function recordedVideo(): Promise<never> {
  throw new Error('Filming is in the iPhone app for now.');
}

/** This page's videos and stills, by memory file name (links into the page's memory, gone when it closes). */
const kept = new Map<string, string>();

export const deviceMemoryFiles: MemoryFiles = {
  sessionOnly: true,
  async keep(sourceUri, name) {
    kept.set(name, sourceUri);
    if (!hasDom()) return {};
    const still = await posterFrame(sourceUri).catch(() => undefined);
    if (!still) return {};
    const thumb = name.replace(/\.[^.]+$/, '') + '.jpg';
    kept.set(thumb, URL.createObjectURL(still));
    return { thumb };
  },
  async remove(names) {
    for (const n of names) {
      if (!n) continue;
      const url = kept.get(n);
      kept.delete(n);
      if (url?.startsWith('blob:') && hasDom()) URL.revokeObjectURL(url);
    }
  },
  // A shared video's own link (https) is its own name.
  uriOf: (name) => kept.get(name) ?? name,
  list: () => [...kept.keys()],
  async saveToPhotos() {
    return false;
  },
};
