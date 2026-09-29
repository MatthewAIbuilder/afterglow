import type { Festival } from '../../data/models';
import { groupFestivals, type Going } from '../festivals/going';
import { countdown, daysUntil } from '../festivals/when';

/**
 * What the bell has for you, worked out from the catalogue and your plans:
 * set times coming out for a festival you're going to, and the festival
 * getting close or starting. Pure: nothing is sent anywhere. Later, likes and
 * followers can join the same list.
 */
export type Notice = {
  /** Stable, so a notice you've read stays read; changes when the news does (e.g. new dates). */
  id: string;
  festivalId: string;
  kind: 'now' | 'soon' | 'setTimes';
  title: string;
  body: string;
};

/** How close a festival must be before the bell mentions it. */
export const SOON_DAYS = 7;

export function notices(festivals: Festival[], going: Going, today: Date): Notice[] {
  const now: Notice[] = [];
  const soon: Notice[] = [];
  const times: Notice[] = [];
  for (const f of groupFestivals(festivals, going, today).going) {
    const until = daysUntil(f, today);
    const when = countdown(f, today);
    if (when === 'Happening now') {
      now.push({ id: `now:${f.id}:${f.startDate}`, festivalId: f.id, kind: 'now', title: `${f.name} is happening now`, body: 'See who your plan says to catch next.' });
    } else if (until !== undefined && until >= 1 && until <= SOON_DAYS) {
      soon.push({
        id: `soon:${f.id}:${f.startDate}`,
        festivalId: f.id,
        kind: 'soon',
        title: `${f.name} starts ${until === 1 ? 'tomorrow' : `in ${until} days`}`,
        body: f.sets?.length ? 'Your day-by-day plan is ready.' : 'Set times aren’t out yet. Your must sees are ready.',
      });
    }
    if (f.sets?.length && when !== 'Over') {
      times.push({ id: `sets:${f.id}`, festivalId: f.id, kind: 'setTimes', title: `Set times are out for ${f.name}`, body: 'Your plan is laid out day by day, with clashes called out.' });
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
