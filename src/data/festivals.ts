import type { Festival, SetTime } from './types';

/**
 * Fictional festivals for the prototype, one in each phase:
 * - Solstice has published set times.
 * - Horizon has a lineup but no set times yet, which is how most festivals
 *   look for most of the year.
 *
 * To show a real lineup poster, paste a direct image link into posterImageUrl.
 */
export const FESTIVALS: Festival[] = [
  {
    id: 'solstice-26',
    name: 'Solstice 2026',
    dates: 'Jun 19 to 21',
    location: 'Lakeside Grounds',
    posterImageUrl: undefined,
    lineup: ['illenium', 'excision', 'john-summit', 'subtronics', 'levity', 'sara-landry', 'tape-b'],
    days: ['Friday', 'Saturday', 'Sunday'],
    stages: [
      { id: 'main', name: 'Main Stage' },
      { id: 'bass', name: 'Bass Tent' },
      { id: 'warehouse', name: 'The Warehouse' },
    ],
    sets: [
      { artistId: 'john-summit', day: 'Friday', stageId: 'main', start: '20:45', end: '22:00' },
      { artistId: 'tape-b', day: 'Friday', stageId: 'bass', start: '22:30', end: '23:30' },
      { artistId: 'subtronics', day: 'Friday', stageId: 'bass', start: '00:15', end: '01:30' },
      { artistId: 'levity', day: 'Saturday', stageId: 'bass', start: '21:30', end: '22:45' },
      { artistId: 'illenium', day: 'Saturday', stageId: 'main', start: '23:40', end: '01:10' },
      { artistId: 'excision', day: 'Sunday', stageId: 'bass', start: '23:00', end: '00:30' },
      { artistId: 'sara-landry', day: 'Sunday', stageId: 'warehouse', start: '02:00', end: '03:30' },
    ],
  },
  {
    id: 'horizon-27',
    name: 'Horizon 2027',
    dates: 'Mar 12 to 14',
    location: 'Desert Valley',
    posterImageUrl: undefined,
    lineup: ['subtronics', 'sara-landry', 'levity', 'john-summit', 'tape-b'],
    days: ['Friday', 'Saturday', 'Sunday'],
    stages: [],
  },
];

export const festivalById = (id: string) => FESTIVALS.find((f) => f.id === id);

export const stageName = (festival: Festival, stageId: string) =>
  festival.stages.find((s) => s.id === stageId)?.name ?? '';

export const setFor = (festival: Festival, artistId: string): SetTime | undefined =>
  festival.sets?.find((s) => s.artistId === artistId);

export const festivalsFor = (artistId: string) => FESTIVALS.filter((f) => f.lineup.includes(artistId));

/** "23:40" -> "11:40 PM" */
export function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "Saturday 11:40 PM, Main Stage" */
export function describeSet(festival: Festival, set: SetTime) {
  return `${set.day} ${formatTime(set.start)}, ${stageName(festival, set.stageId)}`;
}
