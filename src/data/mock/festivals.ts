import type { Festival } from '../models';

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
    // Friday has a close call between two headliners, Saturday a clear winner,
    // Sunday a free evening for something new.
    sets: [
      { artistId: 'tape-b', day: 'Friday', stageId: 'bass', start: '22:00', end: '23:00' },
      { artistId: 'sara-landry', day: 'Friday', stageId: 'warehouse', start: '22:15', end: '23:30' },
      { artistId: 'illenium', day: 'Friday', stageId: 'main', start: '23:40', end: '01:10' },
      { artistId: 'subtronics', day: 'Friday', stageId: 'bass', start: '00:15', end: '01:30' },
      { artistId: 'levity', day: 'Saturday', stageId: 'bass', start: '22:30', end: '23:45' },
      { artistId: 'excision', day: 'Saturday', stageId: 'main', start: '23:00', end: '00:30' },
      { artistId: 'john-summit', day: 'Sunday', stageId: 'main', start: '20:30', end: '22:00' },
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
