import type { Clip, Festival } from '../../data/models';
import { playsOn } from '../festivals/days';
import { toMinutes } from '../plan/plan';
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

/**
 * Tonight's preview, the running order: one clip per artist playing tonight
 * (the best-ranked one), in set-time order once set times are out (artists
 * without a set tonight follow, in their ranked order); before set times,
 * the ranked order. The first `keep` items (on screen and next) never move.
 */
export function tonightOrder<T extends { clip: Clip }>(items: readonly T[], festival: Festival, night: string | undefined, keep = 0): T[] {
  const kept = items.slice(0, keep);
  const seen = new Set(kept.map((i) => i.clip.artistId));
  const rest: T[] = [];
  for (const it of items.slice(keep)) {
    if (seen.has(it.clip.artistId) || !playsOn(festival, it.clip.artistId, night)) continue;
    seen.add(it.clip.artistId);
    rest.push(it);
  }
  const startOf = (artistId: string) => {
    const set = (festival.sets ?? []).find((s) => s.artistId === artistId && (!night || s.day === night));
    return set ? toMinutes(set.start) : Infinity;
  };
  const ranked = rest.map((it, i) => ({ it, i, at: startOf(it.clip.artistId) }));
  ranked.sort((a, b) => a.at - b.at || a.i - b.i);
  return [...kept, ...ranked.map((r) => r.it)];
}

/** Clips worth previewing tonight: the lineup's, of artists playing tonight. */
export const tonightClips = (festival: Festival, clips: readonly Clip[], night: string | undefined) =>
  clips.filter((c) => festival.lineup.includes(c.artistId) && playsOn(festival, c.artistId, night));
