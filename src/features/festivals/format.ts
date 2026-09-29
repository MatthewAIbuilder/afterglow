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
