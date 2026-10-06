import type { Show } from '../../data/models';

/**
 * One-night shows you're going to, pure. A small copy of each show is kept
 * (when, where, who), so it stays in your plans and on your profile after the
 * nightly list moves past it. Shows are never festivals: they don't count
 * towards your festivals.
 */
export type GoingShow = { id: string; date: string; title: string; where: string; artistIds: string[] };

export const GOING_SHOWS_MAX = 60;
/** At most this many upcoming shows on your profile. */
export const PUBLISHED_SHOWS_MAX = 30;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const goingShowOf = (s: Show): GoingShow => ({ id: s.id, date: s.date, title: (s.name ?? s.venue).slice(0, 80), where: s.location.slice(0, 80), artistIds: s.artistIds.slice(0, 12) });

/** Going (newest date first), or not any more. */
export function withGoingShow(list: readonly GoingShow[], show: Show, on: boolean): GoingShow[] {
  const rest = list.filter((s) => s.id !== show.id);
  return (on ? [goingShowOf(show), ...rest] : rest).sort((a, b) => b.date.localeCompare(a.date)).slice(0, GOING_SHOWS_MAX);
}

/** Read back safely. */
export function cleanGoingShows(raw: unknown): GoingShow[] {
  if (!Array.isArray(raw)) return [];
  const out: GoingShow[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,100}$/.test(o.id) || typeof o.date !== 'string' || !DAY.test(o.date) || out.some((s) => s.id === o.id)) continue;
    out.push({
      id: o.id,
      date: o.date,
      title: typeof o.title === 'string' ? o.title.slice(0, 80) : '',
      where: typeof o.where === 'string' ? o.where.slice(0, 80) : '',
      artistIds: Array.isArray(o.artistIds) ? o.artistIds.filter((x): x is string => typeof x === 'string').slice(0, 12) : [],
    });
  }
  return out.slice(0, GOING_SHOWS_MAX);
}

/** Coming up (today on), soonest first, and the ones that have passed, newest first. */
export function splitShows(list: readonly GoingShow[], today: string): { upcoming: GoingShow[]; past: GoingShow[] } {
  return {
    upcoming: list.filter((s) => s.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    past: list.filter((s) => s.date < today).sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/** What your profile shows (when "Show festivals I'm going to" is on): the ids of shows coming up. */
export const publishedShows = (list: readonly GoingShow[], today: string) => splitShows(list, today).upcoming.slice(0, PUBLISHED_SHOWS_MAX).map((s) => s.id);
