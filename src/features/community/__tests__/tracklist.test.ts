import { describe, expect, it } from '@jest/globals';
import type { SharedMemory } from '../../social/models';
import { tracklists } from '../tracklist';

const m = (id: string, uid: string, at: string, track?: { title: string; artist: string }, over: Partial<SharedMemory> = {}): SharedMemory =>
  ({ id, uid, handle: uid, videoUrl: 'https://x/v.mp4', festivalId: 'edc', night: 'Friday', artistId: 'john-summit', capturedAt: at, createdAt: at, ...(track ? { track } : {}), ...over }) as SharedMemory;

describe('crowd tracklists', () => {
  it('puts a set’s songs in the order they were heard, with how many people caught each', () => {
    const lists = tracklists([
      m('1', 'a', '2026-11-06T23:10:00Z', { title: 'Where You Are', artist: 'John Summit' }),
      m('2', 'b', '2026-11-06T22:40:00Z', { title: 'La Danza', artist: 'John Summit' }),
      m('3', 'c', '2026-11-06T23:05:00Z', { title: 'where you are', artist: 'JOHN SUMMIT' }),
      m('4', 'a', '2026-11-06T23:20:00Z'),
      m('5', 'd', '2026-11-06T23:30:00Z', { title: 'Song', artist: 'X' }, { artistId: 'odd-mob' }),
      m('6', 'e', '2024-11-06T23:30:00Z', { title: 'Old', artist: 'Y' }, { past: { name: 'EDC 2024', year: 2024 } as never }),
    ]);
    expect(lists.map((l) => l.artistId)).toEqual(['odd-mob', 'john-summit']);
    const js = lists[1];
    expect(js.tracks.map((x) => [x.track.title, x.people, x.memoryId])).toEqual([
      ['La Danza', 1, '2'],
      ['Where You Are', 2, '3'],
    ]);
  });
});
