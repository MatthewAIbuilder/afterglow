import type { Festival } from '../../data/models';
import { daysUntil } from '../festivals/when';
import { DAY_BREAK, type Schedule, type ScheduleItem, type TimedPick } from './plan';

/**
 * During the festival: what's on your plan right now, and what's next. Pure:
 * the time is passed in.
 *
 * A festival night runs from noon to noon, like the set times (an 01:00 set
 * on "Friday" is Saturday morning on the calendar). Night one starts on the
 * festival's first date, and its days are taken in order from there, so
 * only festivals with both dates and a day per date get a live view.
 */

/** Which festival night it is and how far into it, in the same minutes as the plan's set times. */
export type FestivalNight = { day: string; minute: number };

export function festivalNight(festival: Festival, now: Date): FestivalNight | undefined {
  if (!festival.endDate) return undefined;
  const sinceStart = daysUntil(festival, now);
  if (sinceStart === undefined) return undefined;
  if (daySpan(festival.startDate!, festival.endDate) !== festival.days.length) return undefined;
  let index = -sinceStart;
  let minute = now.getHours() * 60 + now.getMinutes();
  if (minute < DAY_BREAK) {
    index -= 1;
    minute += 24 * 60;
  }
  if (index < 0 || index >= festival.days.length) return undefined;
  return { day: festival.days[index], minute };
}

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};
const daySpan = (start: string, end: string) => dayNumber(end) - dayNumber(start) + 1;

/** Who the plan says to watch in this slot: the suggested set, or both when it's a close call. */
function suggested(item: ScheduleItem): TimedPick[] {
  if (item.kind !== 'clash') return [item.pick];
  const v = item.verdict;
  return v.kind === 'close' ? [v.a, v.b] : [v.pick];
}

export type LiveNow = {
  night: FestivalNight;
  /** What your plan says to watch right now (two when it's a close call). Empty when nothing is on. */
  now: TimedPick[];
  /** The next thing on your plan tonight, if any. */
  next?: TimedPick[];
  /** Whether the next one is a discovery (explore pick) rather than one of your list. */
  nextIsDiscovery?: boolean;
  nowIsDiscovery?: boolean;
};

export function liveNow(festival: Festival, schedule: Schedule, now: Date): LiveNow | undefined {
  const night = festivalNight(festival, now);
  if (!night) return undefined;
  const items = schedule.days.find((d) => d.day === night.day)?.items ?? [];
  const m = night.minute;
  const on = items.find((i) => suggested(i).some((p) => p.start <= m && m < p.end));
  const nowPicks = on ? suggested(on).filter((p) => p.start <= m && m < p.end) : [];
  const upcoming = items.filter((i) => i.start > m).sort((a, b) => a.start - b.start)[0];
  return {
    night,
    now: nowPicks,
    nowIsDiscovery: on?.kind === 'discover',
    next: upcoming ? suggested(upcoming) : undefined,
    nextIsDiscovery: upcoming?.kind === 'discover',
  };
}
