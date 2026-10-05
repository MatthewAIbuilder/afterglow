import { describe, expect, it } from '@jest/globals';
import type { Clip } from '../../../data/models';
import { CLIP_NEWS_DAYS, CLIP_SEEN_MAX, cleanClipMemory, clipNotices, EMPTY_CLIP_MEMORY, trackClips } from '../clipNews';

const DAY = 24 * 60 * 60 * 1000;
const clip = (id: string, artistId: string): Clip => ({ id, artistId, festivalId: 'f', title: 'Live set', durationSec: 60, bpm: 140 });
const names: Record<string, string> = { a: 'ALPHA', b: 'BRAVO', c: 'CHARLIE', d: 'DELTA' };

describe('new sets news', () => {
  it('the first look only takes note', () => {
    const m = trackClips(EMPTY_CLIP_MEMORY, [clip('1', 'a'), clip('2', 'b')], 1);
    expect(m).toEqual({ seen: ['1', '2'], news: [] });
    expect(trackClips(m, [clip('2', 'b'), clip('1', 'a')], 2)).toBe(m);
  });

  it('notices new clips once, never community videos', () => {
    let m = trackClips(EMPTY_CLIP_MEMORY, [clip('1', 'a')], 1);
    m = trackClips(m, [clip('1', 'a'), clip('2', 'b'), clip('community:x', 'c')], 2);
    expect(m.news).toEqual([{ clips: ['2'], at: 2 }]);
    // Gone for a night, then back: not news again.
    m = trackClips(m, [clip('1', 'a')], 3);
    m = trackClips(m, [clip('1', 'a'), clip('2', 'b')], 4);
    expect(m.news).toHaveLength(1);
  });

  it('forgets old news and keeps the memory bounded', () => {
    let m = trackClips(EMPTY_CLIP_MEMORY, [clip('1', 'a')], 0);
    m = trackClips(m, [clip('2', 'a')], 1);
    expect(trackClips(m, [], 1 + CLIP_NEWS_DAYS * DAY).news).toEqual([]);
    // Ids that left the catalogue go first once it's full.
    const many = Array.from({ length: CLIP_SEEN_MAX }, (_, i) => clip(`x${i}`, 'a'));
    const full = trackClips(EMPTY_CLIP_MEMORY, many, 2);
    const next = trackClips(full, [clip('y1', 'a'), clip('y2', 'a'), ...many.slice(10)], 3);
    expect(next.seen).toHaveLength(CLIP_SEEN_MAX);
    expect(next.seen).not.toContain('x0');
    expect(next.seen).toContain('x10');
  });

  it('a catalogue bigger than the memory settles instead of being news again', () => {
    const many = Array.from({ length: CLIP_SEEN_MAX + 10 }, (_, i) => clip(`x${i}`, 'a'));
    const once = trackClips(EMPTY_CLIP_MEMORY, many, 1);
    expect(once.seen).toHaveLength(CLIP_SEEN_MAX + 10);
    const again = trackClips(once, many, 2);
    expect(again).toBe(once);
    expect(cleanClipMemory(JSON.parse(JSON.stringify(once))).seen).toHaveLength(CLIP_SEEN_MAX + 10);
  });

  it('the bell names artists you’d love whose new sets you haven’t watched', () => {
    const all = new Map([clip('1', 'a'), clip('2', 'b'), clip('3', 'a'), clip('4', 'c'), clip('5', 'd')].map((c) => [c.id, c]));
    const news = [
      { clips: ['1', '2', '3', '4'], at: 2 },
      { clips: ['5'], at: 3 },
      { clips: ['gone'], at: 4 },
    ];
    const opts = (loves: string[], watched: string[] = []) => ({
      clip: (id: string) => all.get(id),
      loves: (id: string) => loves.includes(id),
      nameOf: (id: string) => names[id],
      watched: (id: string) => watched.includes(id),
    });
    const n = clipNotices(news, opts(['a', 'c', 'd']));
    expect(n.map((x) => [x.title, x.body, x.href])).toEqual([
      ['A new live set from DELTA', 'Watch it in Discover.', '/?clip=5'],
      ['New live sets from ALPHA and CHARLIE', 'Watch them in Discover.', '/?clip=1'],
    ]);
    expect(n[1]).toMatchObject({ id: 'clips:2', kind: 'clips' });
    expect(clipNotices(news, opts(['a', 'b', 'c']))[0].title).toBe('New live sets from ALPHA, BRAVO and 1 more you’d love');
    // Watched already: starts from the next one, or says nothing.
    expect(clipNotices(news, opts(['a'], ['1']))[0]).toMatchObject({ title: 'A new live set from ALPHA', href: '/?clip=3' });
    expect(clipNotices(news, opts(['a'], ['1', '3']))).toEqual([]);
  });

  it('reads back a saved memory safely', () => {
    expect(cleanClipMemory(null)).toEqual(EMPTY_CLIP_MEMORY);
    expect(cleanClipMemory({ seen: ['1', 2], news: [{ clips: ['1'], at: 5 }, { clips: [], at: 6 }, { at: 'x' }, 3] })).toEqual({ seen: ['1'], news: [{ clips: ['1'], at: 5 }] });
  });
});
