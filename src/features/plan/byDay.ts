import type { Festival } from '../../data/models';
import { daysOf } from '../festivals/days';
import type { Pick } from './plan';

/**
 * Before set times, when the poster says who plays which day: your picks laid
 * out day by day. Pure. Each day lists your must-sees and strong matches
 * (starred first, then best match), then a few picks worth exploring.
 */

/** Explore picks shown under each day. */
export const EXPLORE_PER_DAY = 3;

export type DayPicks = { day: string; planned: Pick[]; explore: Pick[] };

const priority = (a: Pick, b: Pick) =>
  Number(b.pinned) - Number(a.pinned) || Number(b.tier === 'must-see') - Number(a.tier === 'must-see') || b.match - a.match;

export function picksByDay(festival: Festival, picks: Pick[]): { days: DayPicks[]; noDay: Pick[] } {
  const days = festival.days.map((day) => {
    const today = picks.filter((p) => daysOf(festival, p.artist.id).includes(day));
    return {
      day,
      planned: today.filter((p) => p.tier !== 'explore').sort(priority),
      explore: today
        .filter((p) => p.tier === 'explore')
        .sort((a, b) => Number(b.known) - Number(a.known) || b.match - a.match)
        .slice(0, EXPLORE_PER_DAY),
    };
  });
  const noDay = picks.filter((p) => p.tier !== 'explore' && !daysOf(festival, p.artist.id).length).sort(priority);
  return { days, noDay };
}
