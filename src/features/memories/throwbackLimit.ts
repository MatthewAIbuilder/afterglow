/**
 * How many throwbacks (videos from past festivals, from the camera roll) you
 * can share: a few on the free plan, as many as you like with Afterglow Plus.
 * Only sharing counts, since that's what's stored on Afterglow; keeping them
 * in Memories on your phone, and their badges, are always free. Removing a
 * shared throwback gives its place back. Pure; the database rules hold the
 * same line (`usage/{uid}` in firestore.rules).
 */
import { t } from '../../i18n';

export const THROWBACKS_FREE = 3;

export type ThrowbackShares = { canShare: boolean; /** Free shares left; undefined with Plus. */ left?: number };

export function throwbackShares({ plus, used }: { plus: boolean; used: number }): ThrowbackShares {
  if (plus) return { canShare: true };
  const left = Math.max(0, THROWBACKS_FREE - Math.max(0, used));
  return { canShare: left > 0, left };
}

/** What the share switch says about it. */
export function throwbackSharesLine(s: ThrowbackShares): string | undefined {
  if (s.left === undefined) return undefined;
  if (s.left === 0) return t('You’ve shared {n} throwbacks, the most on the free plan. It’s saved in your Memories with its badge. Unlimited throwbacks come with Afterglow Plus.', { n: THROWBACKS_FREE });
  return t('{left} of {total} free throwback shares left.', { left: s.left, total: THROWBACKS_FREE });
}
