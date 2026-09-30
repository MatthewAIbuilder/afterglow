import { describe, expect, it } from '@jest/globals';
import { CLIPS } from '../../../data/mock/clips';
import type { Clip } from '../../../data/types';
import { clipMedia, type YouTubeMedia } from '../media';

const base: Clip = { id: 'x', artistId: 'illenium', festivalId: 'solstice-26', title: 'Test', durationSec: 40, bpm: 150 };

describe('clipMedia', () => {
  it('describes playable footage without the feed needing provider details', () => {
    const m = clipMedia({
      ...base,
      source: { provider: 'youtube', videoId: 'abcDEF12_-x', start: 60, end: 100, channel: 'Official' },
    }) as YouTubeMedia;
    expect(m.provider).toBe('youtube');
    expect(m.lengthSec).toBe(40);
    expect(m.vertical).toBe(false);
    expect(m.credit).toBe('Official on YouTube');
    expect(m.posterUrl).toContain('abcDEF12_-x');
    expect(m.externalUrl).toContain('t=60s');
  });

  it('marks vertical footage', () => {
    const m = clipMedia({
      ...base,
      source: { provider: 'youtube', videoId: 'abcDEF12_-x', start: 0, end: 30, channel: 'Official', vertical: true },
    })!;
    expect(m.vertical).toBe(true);
  });

  it('has no media for a stage clip or a broken source', () => {
    expect(clipMedia(base)).toBeUndefined();
    expect(
      clipMedia({ ...base, source: { provider: 'youtube', videoId: 'bad', start: 0, end: 30, channel: 'x' } }),
    ).toBeUndefined();
  });

  it('plays a community clip from its https file, credited to who filmed it', () => {
    const community = {
      provider: 'community' as const,
      videoUrl: 'https://example.test/v.mp4',
      thumbUrl: 'https://example.test/v.jpg',
      handle: 'maya',
      uid: 'u1',
      sharedId: 's1',
      capturedAt: '2026-06-20T23:00:00.000Z',
      vertical: true,
    };
    const m = clipMedia({ ...base, source: community })!;
    expect(m.provider).toBe('video');
    expect(m.credit).toBe('Filmed by @maya');
    expect(m.lengthSec).toBe(40);
    expect(m.posterUrl).toBe('https://example.test/v.jpg');
    expect(m.vertical).toBe(true);
    expect(clipMedia({ ...base, source: { ...community, videoUrl: 'http://example.test/v.mp4' } })).toBeUndefined();
    expect(clipMedia({ ...base, source: { ...community, thumbUrl: 'file:///x.jpg' } })!.posterUrl).toBe('');
  });

  it('every verified clip source still plays', () => {
    const withSource = CLIPS.filter((c) => c.source);
    expect(withSource.length).toBe(10);
    for (const c of withSource) expect(clipMedia(c)).toBeDefined();
  });
});
