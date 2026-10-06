import { months, t } from '../../i18n';
import { normalize } from '../festivals/search';
import type { Notice } from './inbox';

/**
 * The bell's list, organised, pure: what's happening now first, then the
 * newest first (a notice with no time, like a festival starting soon, counts
 * as today), quick filters by kind, a search, and "2h"-style times.
 */
export type NoticeFilter = 'all' | 'people' | 'festivals' | 'sets' | 'sprouts';

export const FILTER_KINDS: Record<Exclude<NoticeFilter, 'all'>, readonly Notice['kind'][]> = {
  people: ['follow', 'like', 'comment', 'tag', 'crewInvite'],
  festivals: ['now', 'soon', 'setTimes', 'lineup', 'recap'],
  sets: ['clips'],
  sprouts: ['sprout'],
};

/** Now first, then newest first; a notice with no time counts as the start of today. Stable otherwise. */
export function sortNotices(list: readonly Notice[], todayStart: number): Notice[] {
  return list
    .map((n, i) => ({ n, i, at: n.kind === 'now' ? Infinity : (n.at ?? todayStart) }))
    .sort((a, b) => b.at - a.at || a.i - b.i)
    .map((x) => x.n);
}

/** The filters that have something in them (All always). */
export function filtersWith(list: readonly Notice[]): NoticeFilter[] {
  return ['all', ...(Object.keys(FILTER_KINDS) as Exclude<NoticeFilter, 'all'>[]).filter((f) => list.some((n) => FILTER_KINDS[f].includes(n.kind)))];
}

/** One filter and a search (over the title and the line under it). */
export function filterNotices(list: readonly Notice[], filter: NoticeFilter, query: string): Notice[] {
  const q = normalize(query);
  return list.filter((n) => (filter === 'all' || FILTER_KINDS[filter].includes(n.kind)) && (!q || normalize(`${n.title} ${n.body}`).includes(q)));
}

/** "now", "5m", "3h", "2d", or the date ("Oct 3") after a week. */
export function ago(at: number | undefined, now: number): string | undefined {
  if (at === undefined || !Number.isFinite(at)) return undefined;
  const mins = Math.max(0, Math.floor((now - at) / 60_000));
  if (mins < 1) return t('now');
  if (mins < 60) return t('{n}m', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('{n}h', { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('{n}d', { n: days });
  const d = new Date(at);
  return t('{month} {day}', { month: months(true)[d.getMonth()], day: d.getDate() });
}
