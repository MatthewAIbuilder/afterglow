import { describe, expect, it, jest } from '@jest/globals';
import type { SharedMemory } from '../../social/models';
import type { Memory } from '../models';
import { checkWebFile, checkWebMeta, onServer, pickWebVideo, sharedAsMemory, webMoment, webMoments, webVideoFormat, WEB_MAX_CLIP_SECONDS, WEB_MAX_VIDEO_BYTES, type WebFile, type WebPickDeps } from '../webVideo';
import { MAX_CLIP_SECONDS } from '../device';
import { MAX_SHARE_BYTES } from '../../social/service';

const MB = 1024 * 1024;

describe('which files the website takes', () => {
  it('the same limits as the app', () => {
    expect(WEB_MAX_CLIP_SECONDS).toBe(MAX_CLIP_SECONDS);
    expect(WEB_MAX_VIDEO_BYTES).toBe(MAX_SHARE_BYTES);
  });

  it('MP4 and an iPhone’s MOV, by type or by name when the browser gives none', () => {
    expect(webVideoFormat('video/quicktime', 'IMG_0412.MOV')).toBe('video/quicktime');
    expect(webVideoFormat('video/mp4', 'clip.mp4')).toBe('video/mp4');
    expect(webVideoFormat('video/x-m4v', 'a.m4v')).toBe('video/x-m4v');
    expect(webVideoFormat('', 'IMG_0412.MOV')).toBe('video/quicktime');
    expect(webVideoFormat(undefined, 'trip.mp4')).toBe('video/mp4');
    expect(webVideoFormat('application/octet-stream', 'x.m4v')).toBe('video/x-m4v');
    expect(webVideoFormat('video/webm', 'x.webm')).toBeUndefined();
    expect(webVideoFormat('image/jpeg', 'x.mov')).toBeUndefined();
    expect(webVideoFormat('', 'notes.txt')).toBeUndefined();
  });

  it('refuses other files, empty ones and ones over the upload cap', () => {
    expect(checkWebFile({ type: 'video/quicktime', name: 'a.mov', size: 40 * MB })).toEqual({ ok: true, format: 'video/quicktime' });
    expect(checkWebFile({ type: 'video/webm', name: 'a.webm', size: MB })).toEqual({ ok: false, reason: 'wrong-type' });
    expect(checkWebFile({ type: 'video/mp4', name: 'a.mp4', size: 0 })).toEqual({ ok: false, reason: 'failed' });
    expect(checkWebFile({ type: 'video/mp4', name: 'a.mp4', size: 150 * MB - 1 })).toMatchObject({ ok: true });
    expect(checkWebFile({ type: 'video/mp4', name: 'a.mp4', size: 150 * MB })).toEqual({ ok: false, reason: 'too-large' });
  });

  it('a minute long (with a second’s grace), upright or not as the file says, and unreadable ones refused', () => {
    expect(checkWebMeta({ duration: 42.4, width: 1080, height: 1920 })).toEqual({ ok: true, durationSec: 42, width: 1080, height: 1920 });
    expect(checkWebMeta({ duration: 61, width: 1920, height: 1080 })).toEqual({ ok: true, durationSec: 61, width: 1920, height: 1080 });
    expect(checkWebMeta({ duration: 62, width: 1080, height: 1920 })).toEqual({ ok: false, reason: 'too-long' });
    expect(checkWebMeta({ duration: 0.3, width: 0, height: 0 })).toEqual({ ok: true, durationSec: 1, width: undefined, height: undefined });
    expect(checkWebMeta({ duration: Number.NaN, width: 1, height: 1 })).toEqual({ ok: false, reason: 'failed' });
    expect(checkWebMeta({ duration: Infinity, width: 1, height: 1 })).toEqual({ ok: false, reason: 'failed' });
    expect(checkWebMeta(undefined)).toEqual({ ok: false, reason: 'failed' });
  });

  it('when it was made, if the browser says so sensibly', () => {
    const now = Date.UTC(2026, 9, 6, 12);
    expect(webMoment(Date.UTC(2026, 9, 4, 23), now).when?.getTime()).toBe(Date.UTC(2026, 9, 4, 23));
    expect(webMoment(0, now).when?.getTime()).toBe(now);
    expect(webMoment(undefined, now).when?.getTime()).toBe(now);
    expect(webMoment(now + 3_600_000, now).when?.getTime()).toBe(now);
  });
});

describe('choosing a video on the website', () => {
  const file = (over: Partial<WebFile> = {}): WebFile => ({ type: 'video/quicktime', name: 'IMG_0412.MOV', size: 30 * MB, lastModified: Date.UTC(2026, 9, 4, 23), ...over });
  const deps = (f: WebFile | undefined, meta = { duration: 24, width: 1080, height: 1920 }) => {
    const revoke = jest.fn();
    const d: WebPickDeps<WebFile> = {
      choose: async () => f,
      readMeta: async () => meta,
      objectUrl: () => 'blob:https://afterglowmusic.app/abc',
      revoke,
      now: () => Date.UTC(2026, 9, 6, 12),
    };
    return { d, revoke };
  };

  it('an upright iPhone video becomes a draft for the tagging sheet', async () => {
    const { d } = deps(file());
    expect(await pickWebVideo('library', d)).toEqual({
      ok: true,
      video: {
        uri: 'blob:https://afterglowmusic.app/abc',
        source: 'library',
        durationSec: 24,
        width: 1080,
        height: 1920,
        moment: { when: new Date(Date.UTC(2026, 9, 4, 23)) },
        format: 'video/quicktime',
      },
    });
  });

  it('cancelled, too long, too big, the wrong kind, or unreadable: plain reasons, and the page lets go of the file', async () => {
    expect(await pickWebVideo('library', deps(undefined).d)).toEqual({ ok: false, reason: 'cancelled' });
    const long = deps(file(), { duration: 95, width: 1080, height: 1920 });
    expect(await pickWebVideo('library', long.d)).toEqual({ ok: false, reason: 'too-long' });
    expect(long.revoke).toHaveBeenCalledWith('blob:https://afterglowmusic.app/abc');
    expect(await pickWebVideo('library', deps(file({ size: 400 * MB })).d)).toEqual({ ok: false, reason: 'too-large' });
    expect(await pickWebVideo('library', deps(file({ type: 'video/webm', name: 'a.webm' })).d)).toEqual({ ok: false, reason: 'wrong-type' });
    const unreadable = deps(file());
    unreadable.d.readMeta = async () => undefined;
    expect(await pickWebVideo('library', unreadable.d)).toEqual({ ok: false, reason: 'failed' });
    expect(unreadable.revoke).toHaveBeenCalled();
    const broken = deps(file());
    broken.d.choose = async () => {
      throw new Error('no input');
    };
    expect(await pickWebVideo('library', broken.d)).toEqual({ ok: false, reason: 'failed' });
  });

  it('taken with the phone’s camera: filmed now', async () => {
    const r = await pickWebVideo('camera', deps(file({ lastModified: 0 })).d);
    expect(r.ok && r.video.moment.when?.getTime()).toBe(Date.UTC(2026, 9, 6, 12));
  });
});

describe('your moments on the website', () => {
  const shared: SharedMemory = {
    id: 'sh1',
    uid: 'u1',
    handle: 'sam',
    videoUrl: 'https://firebasestorage.googleapis.com/v0/b/b/o/memories%2Fu1%2Fsh1.mov?alt=media&token=t',
    thumbUrl: 'https://firebasestorage.googleapis.com/v0/b/b/o/memories%2Fu1%2Fsh1.jpg?alt=media&token=t',
    festivalId: 'cyclops-cove-4',
    night: 'Saturday',
    artistId: 'subtronics',
    capturedAt: '2026-10-04T23:00:00.000Z',
    durationSec: 24,
    width: 1080,
    height: 1920,
    createdAt: '2026-10-06T12:00:00.000Z',
  };
  const local = (over: Partial<Memory>): Memory => ({ id: 'm1', file: 'm1.mp4', capturedAt: '2026-10-05T22:00:00.000Z', addedAt: '2026-10-06T12:00:00.000Z', ...over });

  it('a shared video reads as a moment that lives on the server', () => {
    const m = sharedAsMemory(shared);
    expect(m).toMatchObject({ id: 'sh1', file: shared.videoUrl, thumb: shared.thumbUrl, sharedId: 'sh1', sharedBy: 'u1', festivalId: 'cyclops-cove-4', artistId: 'subtronics', width: 1080, height: 1920 });
    expect(onServer(m)).toBe(true);
    expect(onServer(local({}))).toBe(false);
  });

  it('one per video: an upload from this page steps aside once the server has it', () => {
    const uploading = local({ id: 'm2' });
    const done = local({ id: 'm1', sharedId: 'sh1', sharedBy: 'u1' });
    expect(webMoments([uploading, done], [shared]).map((m) => m.id)).toEqual(['sh1', 'm2']);
    expect(webMoments([done], []).map((m) => m.id)).toEqual(['m1']);
  });
});
