import { describe, expect, it } from '@jest/globals';
import type { Festival, Show } from '../../../data/models';
import { festivalMode, testFestival, withChoice, NO_MODE, withPreview } from '../mode';
import { eventById, eventPath, isShowEvent, nightDate, showAsEvent, showEventId, showIdOf, showTonight, upcomingShowEvents, weekdayOf } from '../showEvent';
import type { GoingShow } from '../../festivals/goingShows';
import { communityClips } from '../../community/clips';
import type { SharedMemory } from '../../social/models';
import { directionsUrl } from '../../../lib/directions';

const going = (id: string, date: string, over: Partial<GoingShow> = {}): GoingShow => ({ id, date, title: `Night ${id}`, where: 'Denver, CO', artistIds: ['a', 'b'], ...over });
const live = (id: string, date: string, over: Partial<Show> = {}): Show => ({ id, date, venue: 'Club One', location: 'Denver, CO', link: `https://edmtrain.com/${id}`, artistIds: ['a', 'b', 'c'], ...over });
const fest = (id: string, over: Partial<Festival> = {}): Festival =>
  ({ id, name: id.toUpperCase(), dates: '', location: '', lineup: ['a'], days: ['Friday', 'Saturday'], stages: [], ...over }) as Festival;

describe('one-night shows as festival-mode events', () => {
  it('a show becomes a one-night event filed under show:<id>', () => {
    const e = showAsEvent(going('edm-1', '2026-10-09'), live('edm-1', '2026-10-09', { name: 'Halloween Night', place: { lat: 39.7, lon: -105 } }));
    expect(e).toMatchObject({
      id: 'show:edm-1',
      name: 'Night edm-1',
      location: 'Club One, Denver, CO',
      lineup: ['a', 'b', 'c'],
      days: ['Friday'],
      stages: [],
      startDate: '2026-10-09',
      endDate: '2026-10-09',
      place: { lat: 39.7, lon: -105 },
      links: { tickets: 'https://edmtrain.com/edm-1' },
    });
    // With no signal (only the copy kept when you said you're going): its own bill.
    expect(showAsEvent(going('edm-1', '2026-10-09')).lineup).toEqual(['a', 'b']);
    expect(isShowEvent(e)).toBe(true);
    expect(isShowEvent(fest('cc'))).toBe(false);
    expect(showIdOf('show:edm-1')).toBe('edm-1');
    expect(showIdOf('cc')).toBeUndefined();
    expect(showEventId('edm-1')).toBe('show:edm-1');
    expect(eventPath(e)).toBe('/show/edm-1');
    expect(eventPath(fest('cc'))).toBe('/festival/cc');
    expect(weekdayOf('2026-10-10')).toBe('Saturday');
  });

  it('a show is tonight from noon on its day to noon the next', () => {
    const shows = [going('edm-1', '2026-10-09'), going('edm-2', '2026-10-20')];
    expect(showTonight(shows, [], new Date(2026, 9, 9, 11, 59))).toBeUndefined();
    expect(showTonight(shows, [], new Date(2026, 9, 9, 21, 0))).toMatchObject({ festival: { id: 'show:edm-1' }, night: 'Friday' });
    // 2 AM is still that night.
    expect(showTonight(shows, [], new Date(2026, 9, 10, 2, 0))?.festival.id).toBe('show:edm-1');
    expect(showTonight(shows, [], new Date(2026, 9, 10, 12, 0))).toBeUndefined();
    expect(nightDate(new Date(2026, 9, 10, 2, 0))).toBe('2026-10-09');
  });

  it('festival mode asks on the night of a show, and a test can be a show you are going to', () => {
    const now = new Date(2026, 9, 9, 21, 0);
    const tonight = showTonight([going('edm-1', '2026-10-09')], [], now)!;
    expect(festivalMode(NO_MODE, tonight, [], now.getTime()).ask?.id).toBe('show:edm-1');
    expect(festivalMode(withChoice(NO_MODE, 'show:edm-1', 'on'), tonight, [], now.getTime()).active).toMatchObject({ festival: { id: 'show:edm-1' }, night: 'Friday', preview: false });
    // Testing with a show: found among the events passed in.
    const ev = showAsEvent(going('edm-2', '2026-10-20'));
    expect(festivalMode(withPreview(NO_MODE, ev.id, now.getTime()), undefined, [ev], now.getTime()).active).toMatchObject({ festival: { id: 'show:edm-2' }, preview: true });

    // Settings' test: a show you're going to that comes before your next festival, else the festival.
    const later = fest('later', { startDate: '2026-11-01', endDate: '2026-11-02' });
    const today = new Date(2026, 9, 7);
    const shows = upcomingShowEvents([going('edm-2', '2026-10-20'), going('old', '2026-10-01')], [], today);
    expect(shows.map((s) => s.id)).toEqual(['show:edm-2']);
    expect(testFestival([later], ['later'], today, shows)?.id).toBe('show:edm-2');
    expect(testFestival([later], ['later'], today, upcomingShowEvents([going('x', '2026-12-01')], [], today))?.id).toBe('later');
    expect(testFestival([later], ['later'], today)?.id).toBe('later');
  });

  it('finds a show by id: yours first (no signal needed), else the catalogue’s', () => {
    const o = { festival: (id: string) => (id === 'cc' ? fest('cc') : undefined), shows: [going('edm-1', '2026-10-09')], liveShows: [live('edm-9', '2026-10-30', { name: 'Big Night' })] };
    expect(eventById('cc', o)?.id).toBe('cc');
    expect(eventById('show:edm-1', o)?.name).toBe('Night edm-1');
    expect(eventById('show:edm-9', o)?.name).toBe('Big Night');
    expect(eventById('show:nope', o)).toBeUndefined();
  });

  it('crowd videos tagged with the show fill its Discover', () => {
    const base = { uid: 'u2', handle: 'maya', videoUrl: 'https://x/v.mp4', createdAt: '2026-10-09T22:00:00Z', capturedAt: '2026-10-09T22:00:00Z' };
    const memories = [
      { ...base, id: 'm1', artistId: 'c', show: { name: 'Club One', date: '2026-10-09', showId: 'edm-1' } },
      { ...base, id: 'm2', artistId: 'a', show: { name: 'Elsewhere', date: '2026-10-09', showId: 'edm-2' } },
      { ...base, id: 'm3', artistId: 'a', festivalId: 'cc' },
    ] as SharedMemory[];
    const clips = communityClips(memories, { artists: new Set(['a', 'b', 'c']), blocked: new Set(), hidden: new Set(), festival: showAsEvent(going('edm-1', '2026-10-09')) });
    // Even an artist Afterglow knows but the bill doesn't list.
    expect(clips.map((c) => c.id)).toEqual(['community:m1']);
    expect(clips[0].festivalId).toBe('show:edm-1');
  });

  it('directions open the phone’s maps app', () => {
    expect(directionsUrl({ place: { lat: 39.7, lon: -105 }, name: 'Club One' }, 'ios')).toBe('https://maps.apple.com/?daddr=39.7,-105&q=Club%20One');
    expect(directionsUrl({ name: 'Club One, Denver' }, 'ios')).toBe('https://maps.apple.com/?daddr=Club%20One%2C%20Denver');
    expect(directionsUrl({ place: { lat: 39.7, lon: -105 }, name: 'Club One' }, 'android')).toBe('https://www.google.com/maps/dir/?api=1&destination=39.7,-105');
  });
});
