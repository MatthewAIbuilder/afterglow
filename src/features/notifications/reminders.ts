import type { Festival } from '../../data/models';
import type { Going } from '../festivals/going';
import { runsOf } from '../festivals/when';
import { t, tn } from '../../i18n';

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
  /** Where tapping it goes, when not the festival page. */
  href?: string;
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
        title: t('{festival} is a week away', { festival: f.name }),
        body: timesOut ? t('Your day-by-day plan is ready.') : t('Tune your lineup so your must sees are ready.'),
      },
      ...runs.map((run, i) => ({
        start: run.start,
        key: 'eve',
        at: localDay(run.start, 1),
        title: i > 0 ? t('{festival} weekend {w} is tomorrow', { festival: f.name, w: i + 1 }) : t('{festival} is tomorrow', { festival: f.name }),
        body: timesOut ? t('Your plan is laid out day by day, clashes and all.') : t('Your must sees are ready. Have a great one.'),
      })),
    ];
    for (const p of planned) {
      if (p.at.getTime() <= now.getTime()) continue;
      out.push({ id: `${REMINDER_PREFIX}${f.id}:${p.start}:${p.key}:${timesOut ? 'times' : 'lineup'}:${p.at.getTime()}`, festivalId: f.id, at: p.at, title: p.title, body: p.body });
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

/** The checklist reminder the evening before arrives at this hour, and the one on the morning of at the other. */
export const PREP_EVE_HOUR = 18;
export const PREP_DAY_HOUR = 8;

/**
 * Your Get ready checklist, twice for each festival you're going to (each weekend of a two-weekend one): the
 * evening before, to pack and sort the last things, and the morning it starts. Each says how many things are
 * left (their ids carry that number, so a tick moves them on) and opens the checklist. Pure.
 */
export function prepReminders(festivals: Festival[], going: Going, progressOf: (festival: Festival) => { done: number; total: number }, now: Date): Reminder[] {
  const out: Reminder[] = [];
  for (const id of going) {
    const f = festivals.find((x) => x.id === id);
    const runs = f ? runsOf(f) : [];
    if (!f || !runs.length) continue;
    const { done, total } = progressOf(f);
    const left = Math.max(0, total - done);
    const body =
      left > 0
        ? tn(left, '{n} thing left on your checklist. Tap to finish it.', '{n} things left on your checklist. Tap to finish it.')
        : t('Your checklist is all done. Have a great one.');
    runs.forEach((run, i) => {
      const [y, m, d] = run.start.split('-').map(Number);
      const when = [
        { key: 'eve', at: new Date(y, m - 1, d - 1, PREP_EVE_HOUR, 0, 0, 0), title: i > 0 ? t('Packed for {festival} weekend {w}?', { festival: f.name, w: i + 1 }) : t('Packed for {festival}?', { festival: f.name }) },
        { key: 'day', at: new Date(y, m - 1, d, PREP_DAY_HOUR, 0, 0, 0), title: i > 0 ? t('{festival} weekend {w} starts today', { festival: f.name, w: i + 1 }) : t('{festival} starts today', { festival: f.name }) },
      ];
      for (const w of when) {
        if (w.at.getTime() <= now.getTime()) continue;
        out.push({ id: `${REMINDER_PREFIX}prep:${f.id}:${run.start}:${w.key}:${left}:${w.at.getTime()}`, festivalId: f.id, at: w.at, title: w.title, body, href: `/prep/${f.id}` });
      }
    });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

