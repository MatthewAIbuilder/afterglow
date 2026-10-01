import { describe, expect, it } from '@jest/globals';
import type { Artist, Clip } from '../../../data/models';
import type { Pick } from '../plan';
import { WARMUP_MAX, warmupLine, warmupPlaylist } from '../warmup';

const pick = (id: string, tier: Pick['tier'], opts: Partial<Pick> = {}): Pick => ({
  artist: { id, name: id.toUpperCase(), sound: {} } as Artist,
  match: 0.8,
  tier,
  pinned: false,
  known: true,
  ...opts,
});
const yt = (artistId: string, videoId: string): Clip => ({
  id: `c-${artistId}-${videoId}`,
  artistId,
  festivalId: 'f',
  title: 't',
  durationSec: 60,
  bpm: 140,
  source: { provider: 'youtube', videoId, start: 0, end: 60, channel: 'x' },
});
const clips: Record<string, Clip[]> = {
  a: [yt('a', 'aaaaaaaaaaa')],
  b: [yt('b', 'bbbbbbbbbbb')],
  c: [yt('c', 'aaaaaaaaaaa'), yt('c', 'ccccccccccc')], // shares a video with A
  d: [{ id: 'stage', artistId: 'd', festivalId: 'f', title: 't', durationSec: 30, bpm: 128 }], // drawn stage, no video
  e: [yt('e', 'eeeeeeeeeee')],
};
const clipsOf = (id: string) => clips[id] ?? [];

describe('the warm-up playlist', () => {
  it("is one YouTube playlist of your artists' live sets, starred first, each video once", () => {
    const picks = [pick('a', 'must-see'), pick('b', 'strong'), pick('c', 'strong', { pinned: true }), pick('d', 'strong'), pick('e', 'explore', { known: false })];
    const w = warmupPlaylist(picks, clipsOf)!;
    // C (starred) takes the video it shares with A, so A has nothing new; D has no video; E is only a guess.
    expect(w.url).toBe('https://www.youtube.com/watch_videos?video_ids=aaaaaaaaaaa,bbbbbbbbbbb');
    expect(w.artists.map((a) => a.id)).toEqual(['c', 'b']);
    expect(warmupLine(w)).toBe('C and B');
  });

  it('needs at least two sets, and stops at YouTube’s limit', () => {
    expect(warmupPlaylist([pick('a', 'must-see')], clipsOf)).toBeUndefined();
    const many = Array.from({ length: WARMUP_MAX + 5 }, (_, i) => pick(`x${i}`, 'strong'));
    const lots = (id: string) => [yt(id, id.padEnd(11, '0'))];
    expect(warmupPlaylist(many, lots)!.artists).toHaveLength(WARMUP_MAX);
  });
});
