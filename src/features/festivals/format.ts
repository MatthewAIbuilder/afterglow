import { stageName } from '../../data/festival';
import type { Festival, SetTime } from '../../data/models';

/** How festival times read in the app. */

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

/** Clip length: 45 -> "0:45", 75 -> "1:15", 125 -> "2:05". */
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
