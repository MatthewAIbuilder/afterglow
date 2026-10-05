import { describe, expect, it } from '@jest/globals';
import { ARTISTS } from '../../../data/mock/artists';
import { FESTIVALS } from '../../../data/mock/festivals';
import { toMinutes } from '../plan';
import type { DayRoute, RouteStop } from '../route';
import { elsewhereDuring, meetUps, namesLine } from '../withFriends';

const festival = FESTIVALS[0];
const artistOf = (id: string) => ARTISTS.find((a) => a.id === id);
function stop(artistId: string): RouteStop {
  const set = festival.sets!.find((s) => s.artistId === artistId)!;
  const from = toMinutes(set.start);
  const to = toMinutes(set.end);
  return { kind: 'set', artist: artistOf(artistId)!, set, from, to, setStart: from, setEnd: to, match: 0.9, pinned: false, known: true } as RouteStop;
}
const stars: Record<string, string[]> = { illenium: ['Sam'], subtronics: ['Maya', 'Sam'], 'tape-b': ['Jo'] };
const starsFor = (id: string) => stars[id] ?? [];

describe('your plan with your crew', () => {
  it('says who, in a few words', () => {
    const names = ['Maya', 'Sam', 'Jo', 'Ali'];
    expect([0, 1, 2, 3, 4].map((n) => namesLine(names.slice(0, n)))).toEqual(['', 'Maya', 'Maya and Sam', 'Maya, Sam and Jo', 'Maya, Sam and 2 more']);
  });

  it('finds the sets on your day your crew starred too, in order', () => {
    const route: DayRoute = { day: 'Friday', stops: [stop('sara-landry'), { kind: 'break', from: 1410, to: 1420 }, stop('illenium')] as DayRoute['stops'] };
    expect(meetUps(route, starsFor).map((m) => [m.stop.artist.id, m.names])).toEqual([['illenium', ['Sam']]]);
  });

  it('says who is off at something else during your set (not those with you), once each', () => {
    // You're at ILLENIUM (11:40 PM to 1:10 AM): SUBTRONICS overlaps from 12:15; Sam starred both, so Sam is with you.
    const away = elsewhereDuring(festival, artistOf, stop('illenium'), starsFor);
    expect(away.map((e) => [e.name, e.artist.id, e.stageId, e.end])).toEqual([['Maya', 'subtronics', 'bass', toMinutes('01:30')]]);
    // At SARA LANDRY (10:15 to 11:30 PM): Jo is at TAPE B; ILLENIUM starts after you leave.
    expect(elsewhereDuring(festival, artistOf, stop('sara-landry'), starsFor).map((e) => e.name)).toEqual(['Jo']);
    // Another day: nobody.
    expect(elsewhereDuring(festival, artistOf, stop('excision'), starsFor)).toEqual([]);
  });
});
