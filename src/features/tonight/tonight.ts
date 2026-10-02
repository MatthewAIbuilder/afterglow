import type { Festival } from '../../data/models';
import { nightStart } from '../care/care';
import { isLive } from '../festivals/when';
import { festivalNight } from '../plan/live';

/**
 * Festival-day mode, pure: is one of your festivals on right now, which
 * night is it, and has Tonight already opened by itself this night.
 */

export type Tonight = { festival: Festival; night?: string };

/** From the first day to the morning after the last, either weekend of a two-weekend festival (the same window as the festival page's live cards). */
export const isOn = (festival: Festival, now: Date): boolean => isLive(festival, now);

/**
 * The festival you're going to that's on now, with its night ("Saturday")
 * when the dates and days line up; the soonest-started first if two overlap.
 * Pass festivals as they are for you (your weekend).
 */
export function tonightFestival(festivals: readonly Festival[], going: readonly string[], now: Date): Tonight | undefined {
  const on = festivals.filter((f) => going.includes(f.id) && isOn(f, now));
  if (!on.length) return undefined;
  const withNight = on.map((f) => ({ festival: f, night: festivalNight(f, now)?.day }));
  return withNight.find((t) => t.night) ?? withNight[0];
}

/** One key per festival night (nights run noon to noon), so Tonight opens by itself once a night at most. */
export function tonightKey(festivalId: string, now: Date): string {
  const d = new Date(nightStart(now.getTime()));
  return `${festivalId}:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Saturday at Cyclops Cove 4", or just the festival when the night isn't known. */
export const tonightTitle = (t: Tonight) => (t.night ? `${t.night} at ${t.festival.name}` : t.festival.name);
