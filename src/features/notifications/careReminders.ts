import { type Care, lastDose, lastOf, nightStart } from '../care/care';
import { guideEntry } from '../care/guide';
import { t } from '../../i18n';
import { REMINDER_PREFIX, type Reminder } from './reminders';

/** Water reminders stop at this hour of the morning after a festival night. */
export const CARE_UNTIL_HOUR = 6;
/** At most this many water reminders are waiting at once. */
export const CARE_MAX = 12;
/** The soonest one comes no sooner than this. */
const LEAD_MS = 5 * 60_000;

/**
 * Water reminders for tonight, when you've switched them on and a festival
 * you're going to is on: every `waterEvery` minutes from your last water (or,
 * before any, on a steady beat from noon), until 6 AM. Logging water moves them on (their ids carry the
 * time). The words are gentle and say nothing private, since they can show on
 * the lock screen. Pure.
 */
export function careReminders(care: Care, festivalId: string | undefined, now: Date): Reminder[] {
  if (!care.waterEvery || !festivalId) return [];
  const every = care.waterEvery * 60_000;
  const time = now.getTime();
  const start = nightStart(time);
  const end = start + (24 - 12 + CARE_UNTIL_HOUR) * 3_600_000;
  const water = lastOf(care, 'water');
  // No water yet tonight: a steady beat from the start of the night, so other
  // changes (logging food, a check-in) never push the next one back.
  const from = water && water.at >= start ? water.at : start;
  let at = from + every;
  while (at < time + LEAD_MS) at += every;
  const out: Reminder[] = [];
  for (; at <= end && out.length < CARE_MAX; at += every) {
    out.push({
      id: `${REMINDER_PREFIX}care:water:${festivalId}:${at}`,
      festivalId,
      at: new Date(at),
      title: t('Time for some water?'),
      body: t('Take a few sips and a breather somewhere cool. Tap to log it.'),
      href: '/care',
    });
  }
  return out;
}

/** At most this many "How are you feeling?" reminders are waiting at once. */
export const FEEL_MAX = 8;
/** A stopwatch for something not in the timing guide is asked about for this long after you last took it. */
export const FEEL_UNGUIDED_MIN = 6 * 60;

/**
 * "How are you feeling?" reminders while a stopwatch runs, when you've
 * switched them on: every `feelEvery` minutes from your last check-in (or
 * from when the first running stopwatch started), until the last one should
 * have worn off (`lastDose` plus the timing guide's latest end, or
 * `FEEL_UNGUIDED_MIN`). Stopping the stopwatches stops them; each check-in
 * starts the clock again. Nothing private on the lock screen: no names of
 * what you took. Not tied to a festival. Pure.
 */
export function feelReminders(care: Care, now: Date): Reminder[] {
  if (!care.feelEvery || !care.timers.length) return [];
  const every = care.feelEvery * 60_000;
  const time = now.getTime();
  const started = Math.min(...care.timers.map((x) => x.startedAt));
  const until = Math.min(
    time + 12 * 3_600_000,
    Math.max(...care.timers.map((x) => lastDose(x) + (guideEntry(x.guide)?.total[1] ?? FEEL_UNGUIDED_MIN) * 60_000)),
  );
  const checkin = lastOf(care, 'checkin');
  const from = checkin && checkin.at >= started ? checkin.at : started;
  let at = from + every;
  while (at < time + LEAD_MS) at += every;
  const out: Reminder[] = [];
  for (; at <= until && out.length < FEEL_MAX; at += every) {
    out.push({
      id: `${REMINDER_PREFIX}care:feel:${at}`,
      festivalId: '',
      at: new Date(at),
      title: t('How are you feeling?'),
      body: t('A quick check-in. Tap to answer, it takes a second.'),
      href: '/care?part=feelings',
    });
  }
  return out;
}
