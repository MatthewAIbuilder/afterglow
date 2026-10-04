import { describe, expect, it } from '@jest/globals';
import { MOCK_CATALOG } from '../../../data/mock';
import { CLIPS } from '../../../data/mock/clips';
import type { Clip, YouTubeClipSource } from '../../../data/models';
import { clipProgress, parsePlayerMessage, playableSource, playerHtml, posterUrl, watchUrl } from '../youtube';

const artistById = MOCK_CATALOG.artist;

const source: YouTubeClipSource = { provider: 'youtube', videoId: 'abcDEF12_-x', start: 60, end: 100, channel: 'Official' };
const clip = (s?: Partial<YouTubeClipSource> | null): Clip => ({
  id: 'x',
  artistId: 'illenium',
  festivalId: 'solstice-26',
  title: 'Test',
  durationSec: 40,
  bpm: 150,
  source: s === null ? undefined : { ...source, ...s },
});

describe('playableSource', () => {
  it('returns the source when it is complete', () => {
    expect(playableSource(clip())).toEqual(source);
  });

  it('falls back to the stage without a source', () => {
    expect(playableSource(clip(null))).toBeUndefined();
  });

  it('falls back when the video id is malformed', () => {
    expect(playableSource(clip({ videoId: 'short' }))).toBeUndefined();
    expect(playableSource(clip({ videoId: 'https://youtu.be/abcDEF12_-x' }))).toBeUndefined();
  });

  it('falls back when the section is empty or backwards', () => {
    expect(playableSource(clip({ end: 60 }))).toBeUndefined();
    expect(playableSource(clip({ start: 120 }))).toBeUndefined();
    expect(playableSource(clip({ start: -5 }))).toBeUndefined();
    expect(playableSource(clip({ end: NaN }))).toBeUndefined();
  });
});

describe('clipProgress', () => {
  it('measures progress through the section and clamps to it', () => {
    expect(clipProgress(60, source)).toBe(0);
    expect(clipProgress(80, source)).toBe(0.5);
    expect(clipProgress(30, source)).toBe(0);
    expect(clipProgress(140, source)).toBe(1);
  });

  it('ends early when the video is shorter than the section', () => {
    expect(clipProgress(80, source, 80)).toBe(1);
    expect(clipProgress(70, source, 80)).toBe(0.5);
    // A missing or nonsense duration is ignored.
    expect(clipProgress(80, source, 0)).toBe(0.5);
    expect(clipProgress(80, source, 30)).toBe(0.5);
  });
});

describe('posterUrl', () => {
  it("uses the video's own still", () => {
    expect(posterUrl(source)).toBe('https://i.ytimg.com/vi/abcDEF12_-x/hqdefault.jpg');
  });
});

describe('watchUrl', () => {
  it('links to the same moment on YouTube', () => {
    expect(watchUrl(source)).toBe('https://www.youtube.com/watch?v=abcDEF12_-x&t=60s');
  });
});

describe('parsePlayerMessage', () => {
  it('reads the messages the player page sends', () => {
    expect(parsePlayerMessage('{"type":"ready"}')).toEqual({ type: 'ready' });
    expect(parsePlayerMessage('{"type":"error","code":150}')).toEqual({ type: 'error', code: 150 });
    expect(parsePlayerMessage('{"type":"time","time":61.5}')).toEqual({ type: 'time', time: 61.5 });
    expect(parsePlayerMessage('{"type":"time","time":61.5,"duration":3600}')).toEqual({
      type: 'time',
      time: 61.5,
      duration: 3600,
    });
  });

  it('ignores anything else', () => {
    expect(parsePlayerMessage('not json')).toBeUndefined();
    expect(parsePlayerMessage('{"type":"time"}')).toBeUndefined();
    expect(parsePlayerMessage('null')).toBeUndefined();
  });
});

describe('playerHtml', () => {
  it('uses the official player with its own controls, inline, for the chosen section', () => {
    const html = playerHtml(source, 'https://example.test');
    expect(html).toContain('<script src="https://www.youtube.com/iframe_api"></script>');
    expect(html).toContain('controls: 1');
    expect(html).toContain('playsinline: 1');
    expect(html).toContain('"videoId":"abcDEF12_-x"');
    expect(html).toContain('"start":60');
    expect(html).toContain('"end":100');
  });

  it('restarts the section playing or paused, as asked', () => {
    const html = playerHtml(source, 'https://example.test');
    expect(html).toMatch(/restart: function \(play, sound\)/);
    // Coming on screen with sound unmutes first: YouTube remembers a mute across players.
    expect(html).toMatch(/if \(sound && player.unMute\) player.unMute\(\);/);
    expect(html).toContain('if (play) player.playVideo(); else player.pauseVideo();');
  });
});

describe('feed clips', () => {
  const sourced = CLIPS.filter((c) => c.source);

  it('every real clip is playable, credited and belongs to a known artist', () => {
    for (const c of sourced) {
      expect(playableSource(c)).toBeDefined();
      expect((c.source as YouTubeClipSource).channel.trim()).not.toBe('');
      expect(artistById(c.artistId)).toBeDefined();
    }
  });

  it('real clip lengths match their section and stay under a minute', () => {
    for (const c of sourced) {
      const s = c.source as YouTubeClipSource;
      expect(c.durationSec).toBe(s.end - s.start);
      expect(c.durationSec).toBeLessThan(60);
    }
  });

  it('clip ids stay unique so saved reactions keep pointing at the right clip', () => {
    expect(new Set(CLIPS.map((c) => c.id)).size).toBe(CLIPS.length);
  });
});
