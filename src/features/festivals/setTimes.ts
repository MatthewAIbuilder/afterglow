import type { Festival } from '../../data/models';
import { daysUntil } from './when';
import { runLabel } from './weekend';
import { t } from '../../i18n';

/**
 * When set times might come out, before they have: festivals usually
 * publish them one to two weeks before the first day. A quiet line so the
 * plan's two phases feel connected. Pure; undefined once set times are
 * out, without dates, or once the festival has started.
 */
export const SET_TIMES_EARLY_DAYS = 14;
export const SET_TIMES_LATE_DAYS = 7;

const shift = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
};

export function setTimesExpected(festival: Festival, today: Date, going = false): string | undefined {
  if (festival.sets?.length || !festival.startDate) return undefined;
  const until = daysUntil(festival, today);
  if (until === undefined || until <= 0) return undefined;
  const heads = going ? ` ${t('You’ll get a note in the bell when they’re out.')}` : '';
  if (until > SET_TIMES_EARLY_DAYS) {
    const window = runLabel({ start: shift(festival.startDate, -SET_TIMES_EARLY_DAYS), end: shift(festival.startDate, -SET_TIMES_LATE_DAYS) });
    return t('Set times usually come out a week or two before. Look out around {dates}.', { dates: window }) + heads;
  }
  if (until > SET_TIMES_LATE_DAYS) return t('Set times could come out any day now.') + heads;
  return t('Set times are usually out by now. Your picks turn into a schedule the moment they are.') + heads;
}
