import { stageName } from '../../data/festival';
import type { Festival, SetTime } from '../../data/models';
import { runLabel } from './weekend';
import { LANGUAGE, t } from '../../i18n';

/** How festival times read in the app. */

/** "23:40" -> "11:40 PM" (Spanish keeps the 24-hour clock: "23:40"). */
export function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  if (LANGUAGE === 'es') return `${h}:${String(m).padStart(2, '0')}`;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "Saturday 11:40 PM, Main Stage" */
export function describeSet(festival: Festival, set: SetTime) {
  return `${t(set.day)} ${formatTime(set.start)}, ${stageName(festival, set.stageId)}`;
}

/** Clip length: 45 -> "0:45", 75 -> "1:15", 125 -> "2:05". */
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The festival's dates as they read in the app's language: the catalogue's
 * own words in English ("Nov 6 to 8"), worked out from its dates otherwise.
 */
export function datesLine(festival: Pick<Festival, 'dates'> & Partial<Pick<Festival, 'startDate' | 'endDate'>>) {
  if (LANGUAGE === 'en' || !festival.startDate) return festival.dates;
  return runLabel({ start: festival.startDate, end: festival.endDate ?? festival.startDate });
}

/** "Nov 6 to 8, Tinker Field, Orlando", or just the dates when the place isn't known yet. */
export const whereWhen = (festival: Pick<Festival, 'dates' | 'location'> & Partial<Pick<Festival, 'startDate' | 'endDate'>>) =>
  [datesLine(festival), festival.location].filter(Boolean).join(', ');
