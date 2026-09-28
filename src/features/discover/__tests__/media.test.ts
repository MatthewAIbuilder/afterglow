import { describe, expect, it } from '@jest/globals';
import { CLIPS } from '../../../data/clips';
import type { Clip } from '../../../data/types';
import { clipMedia } from '../media';

const base: Clip = { id: 'x', artistId: 'illenium', festivalId: 'solstice-26', title: 'Test', durationSec: 40, bpm: 150 };

describe('clipMedia', () => {
  it('describes playable footage without the feed needing provider details', () => {
    const m = clipMedia({
      ...base,
      source: { provider: 'youtube', videoId: 'abcDEF12_-x', start: 60, end: 100, channel: 'Official' },
    })!;
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

  it('every verified clip source still plays', () => {
    const withSource = CLIPS.filter((c) => c.source);
    expect(withSource.length).toBe(10);
    for (const c of withSource) expect(clipMedia(c)).toBeDefined();
  });
});
