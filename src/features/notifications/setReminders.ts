import type { Festival } from '../../data/models';
import { formatTime } from '../festivals/format';
import { clockTime, WALK_MINUTES, type DayRoute, type RouteStop } from '../plan/route';
import { REMINDER_PREFIX, type Reminder } from './reminders';

/**
 * Reminders before your sets: a nudge before each stop on your full-day
 * route where you need to move (the first set of the night, after a break,
 * or when it's on another stage), early enough to walk there. Pure: which
 * reminders should exist, from the route and "now"; ReminderSync schedules
 * them alongside the festival reminders (same prefix, so the same tidy-up).
 *
 * Only festivals whose days line up with their dates (a day per date, like
 * the live view) can be timed.
 */
export const SET_PREFIX = `${REMINDER_PREFIX}set:`;
/** How long before you need to move the reminder comes. */
export const SET_LEAD_MIN = 10;
/** The phone keeps at most 64 scheduled reminders for an app; set reminders take at most this many (the soonest). */
export const SET_REMINDERS_MAX = 40;

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** Midnight (local time) at the start of each festival day, or undefined when the days don't line up with the dates. */
export function dayStarts(festival: Festival): Map<string, Date> | undefined {
  if (!festival.startDate || !festival.endDate) return undefined;
  if (dayNumber(festival.endDate) - dayNumber(festival.startDate) + 1 !== festival.days.length) return undefined;
  const [y, m, d] = festival.startDate.split('-').map(Number);
  return new Map(festival.days.map((day, i) => [day, new Date(y, m - 1, d + i, 0, 0, 0, 0)]));
}

/** Can reminders be timed for this festival at all (set times out, and dates that match its days)? */
export const canRemindSets = (festival: Festival) => !!festival.sets?.length && !!dayStarts(festival);

export function setReminders(festival: Festival, route: DayRoute[], now: Date): Reminder[] {
  const starts = dayStarts(festival);
  if (!starts) return [];
  const out: Reminder[] = [];
  for (const day of route) {
    const midnight = starts.get(day.day);
    if (!midnight) continue;
    let prev: RouteStop | undefined;
    let afterBreak = true;
    for (const item of day.stops) {
      if (item.kind === 'break') {
        afterBreak = true;
        continue;
      }
      const stop = item;
      const otherStage = !!prev && prev.set.stageId !== stop.set.stageId;
      const moving = afterBreak || !!stop.walk || otherStage;
      // The route counts a walk between back-to-back sets; after a break on another stage you still walk.
      const walk = stop.walk ?? (otherStage ? WALK_MINUTES : 0);
      prev = stop;
      afterBreak = false;
      if (!moving) continue;
      const leave = stop.from - walk;
      // Clock time on that day (a clock change in the night is the date's to handle, not a fixed count of minutes).
      const at = new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate(), 0, leave - SET_LEAD_MIN);
      if (at.getTime() <= now.getTime()) continue;
      const stage = festival.stages.find((s) => s.id === stop.set.stageId)?.name ?? 'the stage';
      const time = formatTime(clockTime(stop.from));
      out.push({
        // The time is in the id: if it moves (another time zone, a clock change), the old one goes and the new one is set.
        id: `${SET_PREFIX}${festival.id}:${day.day}:${stop.artist.id}:${leave}:${at.getTime()}`,
        festivalId: festival.id,
        at,
        title: `${stop.pinned ? '★ ' : ''}${stop.artist.name} at ${time}`,
        body: walk
          ? `Head to ${stage} in ${SET_LEAD_MIN} min (a ${walk} min walk).`
          : `Be at ${stage} in ${SET_LEAD_MIN} min.`,
      });
    }
  }
  return out;
}

/** The soonest set reminders across festivals, at most SET_REMINDERS_MAX. */
export const soonest = (list: Reminder[]) => [...list].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, SET_REMINDERS_MAX);
