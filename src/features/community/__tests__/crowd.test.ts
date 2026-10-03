import { describe, expect, it } from '@jest/globals';
import type { SharedMemory } from '../../social/models';
import { crowdArtists, crowdByNight, crowdLine, crowdVideos, liveCrowd, OTHER_NIGHT } from '../crowd';

const m = (id: string, uid: string, night: string | undefined, at: number, artistId?: string): SharedMemory => ({
  id,
  uid,
  handle: uid,
  videoUrl: 'https://x/v.mp4',
  night,
  artistId,
  capturedAt: new Date(2026, 11, at, 22).toISOString(),
  createdAt: new Date(2026, 11, at, 23).toISOString(),
});

describe('videos from the crowd', () => {
  const festival = { days: ['Friday', 'Saturday', 'Sunday'] };
  const list = [m('a', 'maya', 'Saturday', 5, 'subtronics'), m('b', 'sam', 'Friday', 4, 'subtronics'), m('c', 'jo', 'Saturday', 5), m('d', 'jo', undefined, 6, 'levity'), m('e', 'maya', 'Monday', 7, 'levity'), m('a', 'maya', 'Saturday', 5)];

  it('leave out blocked people, hidden videos and repeats', () => {
    expect(crowdVideos(list, { blocked: ['sam'], hidden: ['c'] }).map((x) => x.id)).toEqual(['a', 'd', 'e']);
  });

  it('go night by night in the festival’s order, with the rest last', () => {
    const nights = crowdByNight(crowdVideos(list), festival);
    expect(nights.map((n) => [n.night, n.videos.map((v) => v.id)])).toEqual([
      ['Friday', ['b']],
      ['Saturday', ['a', 'c']],
      [OTHER_NIGHT, ['e', 'd']],
    ]);
    expect(crowdByNight(crowdVideos(list), festival, 'levity').map((n) => n.night)).toEqual([OTHER_NIGHT]);
  });

  it('offer the artists filmed most, and say how many', () => {
    expect(crowdArtists(crowdVideos(list))).toEqual([
      { artistId: 'levity', count: 2 },
      { artistId: 'subtronics', count: 2 },
    ]);
    expect(crowdLine(crowdVideos(list))).toBe('5 videos from 3 people');
  });
});

describe('live from the crowd', () => {
  it('keeps videos filmed in the last few hours, newest first', () => {
    const now = new Date(2026, 11, 5, 23, 0).getTime();
    const v = (id: string, minutesAgo: number): SharedMemory => ({ id, uid: 'u', handle: 'u', videoUrl: 'https://x/v.mp4', capturedAt: new Date(now - minutesAgo * 60_000).toISOString(), createdAt: new Date(now).toISOString() });
    expect(liveCrowd([v('old', 200), v('a', 30), v('b', 5), v('future', -60)], now).map((m) => m.id)).toEqual(['b', 'a']);
  });
});
