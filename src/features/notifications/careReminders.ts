import { type Care, lastOf, nightStart } from '../care/care';
import { REMINDER_PREFIX, type Reminder } from './reminders';

/** Water reminders stop at this hour of the morning after a festival night. */
export const CARE_UNTIL_HOUR = 6;
/** At most this many water reminders are waiting at once. */
export const CARE_MAX = 12;
/** The soonest one comes no sooner than this. */
const LEAD_MS = 5 * 60_000;

/**
 * Water reminders for tonight, when you've switched them on and a festival
 * you're going to is on: every `waterEvery` minutes from your last water (or
 * from now), until 6 AM. Logging water moves them on (their ids carry the
 * time). The words are gentle and say nothing private, since they can show on
 * the lock screen. Pure.
 */
export function careReminders(care: Care, festivalId: string | undefined, now: Date): Reminder[] {
  if (!care.waterEvery || !festivalId) return [];
  const every = care.waterEvery * 60_000;
  const t = now.getTime();
  const start = nightStart(t);
  const end = start + (24 - 12 + CARE_UNTIL_HOUR) * 3_600_000;
  const water = lastOf(care, 'water');
  const from = water && water.at >= start ? water.at : t;
  let at = from + every;
  while (at < t + LEAD_MS) at += every;
  const out: Reminder[] = [];
  for (; at <= end && out.length < CARE_MAX; at += every) {
    out.push({
      id: `${REMINDER_PREFIX}care:water:${festivalId}:${at}`,
      festivalId,
      at: new Date(at),
      title: 'Time for some water?',
      body: 'Take a few sips and a breather somewhere cool. Tap to log it.',
      href: '/care',
    });
  }
  return out;
}
