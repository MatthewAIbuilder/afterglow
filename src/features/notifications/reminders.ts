import type { Festival } from '../../data/models';
import type { Going } from '../festivals/going';
import { runsOf } from '../festivals/when';

/**
 * Reminders the phone shows even when the app is closed: a week before and
 * the day before each festival you're going to. Pure: which reminders should
 * exist, worked out from your plans and "now"; scheduling them is done
 * elsewhere (useReminders).
 */
export type Reminder = {
  /** Stable, so scheduling is idempotent; changes when the dates do. */
  id: string;
  festivalId: string;
  at: Date;
  title: string;
  body: string;
};

/** Every reminder id starts with this, so the app only ever touches its own. */
export const REMINDER_PREFIX = 'afterglow-remind:';
/** Reminders arrive mid-morning, local time. */
export const REMINDER_HOUR = 10;

const localDay = (iso: string, daysBefore: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d - daysBefore, REMINDER_HOUR, 0, 0, 0);
};

export function festivalReminders(festivals: Festival[], going: Going, now: Date): Reminder[] {
  const out: Reminder[] = [];
  for (const id of going) {
    const f = festivals.find((x) => x.id === id);
    const runs = f ? runsOf(f) : [];
    if (!f || !runs.length) continue;
    const timesOut = !!f.sets?.length;
    // A week before it all starts, and the day before each weekend (just once for most festivals).
    const planned = [
      {
        start: runs[0].start,
        key: 'week',
        at: localDay(runs[0].start, 7),
        title: `${f.name} is a week away`,
        body: timesOut ? 'Your day-by-day plan is ready.' : 'Tune your lineup so your must sees are ready.',
      },
      ...runs.map((run, i) => ({
        start: run.start,
        key: 'eve',
        at: localDay(run.start, 1),
        title: `${f.name}${i > 0 ? ` weekend ${i + 1}` : ''} is tomorrow`,
        body: timesOut ? 'Your plan is laid out day by day, clashes and all.' : 'Your must sees are ready. Have a great one.',
      })),
    ];
    for (const p of planned) {
      if (p.at.getTime() <= now.getTime()) continue;
      out.push({ id: `${REMINDER_PREFIX}${f.id}:${p.start}:${p.key}:${timesOut ? 'times' : 'lineup'}`, festivalId: f.id, at: p.at, title: p.title, body: p.body });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** What to change so the phone holds exactly the reminders wanted: ours that are stale, and wanted ones missing. */
export function reminderChanges(wanted: Reminder[], scheduledIds: string[]) {
  const want = new Set(wanted.map((r) => r.id));
  const have = new Set(scheduledIds);
  return {
    cancel: scheduledIds.filter((id) => id.startsWith(REMINDER_PREFIX) && !want.has(id)),
    schedule: wanted.filter((r) => !have.has(r.id)),
  };
}
