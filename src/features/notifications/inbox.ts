import type { Festival } from '../../data/models';
import { groupFestivals, type Going } from '../festivals/going';
import { countdown, nextRun } from '../festivals/when';
import { t } from '../../i18n';

/**
 * What the bell has for you, worked out from the catalogue and your plans:
 * set times coming out for a festival you're going to, and the festival
 * getting close or starting. Pure: nothing is sent anywhere. New followers
 * and likes on your videos join the same list (see activity.ts).
 */
export type Notice = {
  /** Stable, so a notice you've read stays read; changes when the news does (e.g. new dates). */
  id: string;
  kind: 'now' | 'soon' | 'setTimes' | 'lineup' | 'clips' | 'follow' | 'like' | 'comment' | 'recap' | 'crewInvite' | 'sprout' | 'tag' | 'kandi' | 'glow' | 'org';
  title: string;
  body: string;
  /** Where tapping it goes. */
  href: string;
  /** The festival it's about (festival notices). */
  festivalId?: string;
  /** When it happened (ms), for the newest first and "2h ago"; festival status notices have none (they're about now). */
  at?: number;
};

/** How close a festival must be before the bell mentions it. */
export const SOON_DAYS = 7;

export function notices(festivals: Festival[], going: Going, today: Date): Notice[] {
  const now: Notice[] = [];
  const soon: Notice[] = [];
  const times: Notice[] = [];
  for (const f of groupFestivals(festivals, going, today).going) {
    // The weekend that's on or next (the whole festival, for most).
    const next = nextRun(f, today);
    const when = countdown(f, today);
    const until = next?.until;
    const weekend = next && next.index > 0 ? next.index + 1 : 0;
    if (next && next.until <= 0) {
      now.push({ id: `now:${f.id}:${next.run.start}`, festivalId: f.id, href: `/festival/${f.id}`, kind: 'now', title: t('{festival} is happening now', { festival: f.name }), body: t('See who your plan says to catch next.') });
    } else if (next && until !== undefined && until >= 1 && until <= SOON_DAYS) {
      soon.push({
        id: `soon:${f.id}:${next.run.start}`,
        festivalId: f.id,
        href: `/festival/${f.id}`,
        kind: 'soon',
        title: weekend
          ? until === 1
            ? t('{festival} weekend {w} starts tomorrow', { festival: f.name, w: weekend })
            : t('{festival} weekend {w} starts in {n} days', { festival: f.name, w: weekend, n: until })
          : until === 1
            ? t('{festival} starts tomorrow', { festival: f.name })
            : t('{festival} starts in {n} days', { festival: f.name, n: until }),
        body: f.sets?.length ? t('Your day-by-day plan is ready.') : t('Set times aren’t out yet. Your must sees are ready.'),
      });
    }
    if (f.sets?.length && when !== t('Over')) {
      times.push({ id: `sets:${f.id}`, festivalId: f.id, href: `/festival/${f.id}`, kind: 'setTimes', title: t('Set times are out for {festival}', { festival: f.name }), body: t('Your plan is laid out day by day, with clashes called out.') });
    }
  }
  return [...now, ...soon, ...times];
}

/** Keep only well-formed ids, e.g. when reading them back from storage. */
export function cleanRead(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

export const unreadCount = (list: Notice[], read: ReadonlySet<string>) => list.filter((n) => !read.has(n.id)).length;
