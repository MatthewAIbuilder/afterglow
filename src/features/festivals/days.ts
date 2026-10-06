import type { Festival } from '../../data/models';
import { dayWord, t } from '../../i18n';

/**
 * Which day an artist plays, before and after set times. Pure. Set times say
 * it once they're out; before that the poster often does (`artistDays`).
 */

/** The festival days an artist plays, in the festival's order. Empty when nobody's said yet. */
export function daysOf(festival: Festival, artistId: string): string[] {
  const fromSets = new Set((festival.sets ?? []).filter((s) => s.artistId === artistId).map((s) => s.day));
  const given = fromSets.size ? fromSets : new Set(festival.artistDays?.[artistId] ?? []);
  return festival.days.filter((d) => given.has(d));
}

/** "Friday", "Saturday and Sunday", "Friday, Saturday and Sunday". Undefined for none. */
export function dayList(days: string[]): string | undefined {
  if (!days.length) return undefined;
  if (days.length === 1) return t(days[0]);
  // Only the first day starts with a capital (Spanish writes the rest in lower case: "Sábado y domingo").
  return t('{list} and {last}', { list: days.slice(0, -1).map((d, i) => (i ? dayWord(d) : t(d))).join(', '), last: dayWord(days[days.length - 1]) });


}

/**
 * The days worth filtering a lineup by: the festival's days, when most of the
 * lineup (at least `share`) has a day, and more than one day has someone on.
 * Otherwise none, so a filter never hides most of the lineup.
 */
export function lineupDays(festival: Festival, share = 0.5): string[] {
  if (festival.days.length < 2 || !festival.lineup.length) return [];
  const known = festival.lineup.filter((id) => daysOf(festival, id).length).length;
  if (known / festival.lineup.length < share) return [];
  const used = festival.days.filter((d) => festival.lineup.some((id) => daysOf(festival, id).includes(d)));
  return used.length > 1 ? used : [];
}

/** Does this artist play that day? No day picked means everyone. */
export const playsOn = (festival: Festival, artistId: string, day: string | undefined) =>
  !day || daysOf(festival, artistId).includes(day);
