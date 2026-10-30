import type { Festival } from '../../data/models';
import { REMINDER_PREFIX, type Reminder } from '../notifications/reminders';
import { dayStarts } from '../notifications/setReminders';
import type { DayRoute } from '../plan/route';
import { ASK_AFTER_MIN, ASK_MIN_STINT, type Askable } from './seen';
import { t } from '../../i18n';

/**
 * "How was it?" for the sets on your route, timed. Pure: which sets can be
 * asked about (from the route and the festival's dates), and the
 * notifications that ask, a few minutes after you leave each one.
 */
export const RATE_PREFIX = `${REMINDER_PREFIX}rate:`;

/** Each set on your route you'd be at long enough, with when you leave it (ms). */
export function askables(festival: Festival, route: readonly DayRoute[]): Askable[] {
  const starts = dayStarts(festival);
  if (!starts) return [];
  const out: Askable[] = [];
  for (const day of route) {
    const midnight = starts.get(day.day);
    if (!midnight) continue;
    for (const stop of day.stops) {
      if (stop.kind !== 'set' || stop.to - stop.from < ASK_MIN_STINT) continue;
      const endsAt = new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate(), 0, stop.to).getTime();
      out.push({ festivalId: festival.id, artistId: stop.artist.id, day: day.day, endsAt });
    }
  }
  return out;
}

export const rateHref = (a: Pick<Askable, 'festivalId' | 'artistId' | 'day'>) =>
  `/rate-set?festival=${encodeURIComponent(a.festivalId)}&artist=${encodeURIComponent(a.artistId)}&day=${encodeURIComponent(a.day)}`;

/** The notifications that ask, for sets still to come. */
export function rateReminders(festival: Festival, route: readonly DayRoute[], artistName: (id: string) => string, now: Date): Reminder[] {
  return askables(festival, route)
    .map((a) => ({ a, at: new Date(a.endsAt + ASK_AFTER_MIN * 60_000) }))
    .filter(({ at }) => at.getTime() > now.getTime())
    .map(({ a, at }) => ({
      id: `${RATE_PREFIX}${festival.id}:${a.day}:${a.artistId}:${at.getTime()}`,
      festivalId: festival.id,
      at,
      title: t('How was {artist}?', { artist: artistName(a.artistId) }),
      body: t('One tap to rate the set. It goes in Sets you’ve seen.'),
      href: rateHref(a),
    }));
}
