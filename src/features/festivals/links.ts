import { setFor } from '../../data/festival';
import { describeSet } from './format';
import { dayList, daysOf } from './days';
import { setLine } from './when';
import type { Clip, Festival } from '../../data/types';

/**
 * How Discover, artists and festivals point at each other. Pure, so the
 * relationships are easy to test.
 *
 * Discover is always focused on one festival: you're discovering artists who
 * actually play it. From a clip you can go to the artist (in that festival's
 * context, so must-see stars apply there), to the festival's lineup, and to
 * your plan on the festival page; from a festival you can go back to
 * Discover focused on its lineup.
 */

export const playsAt = (festival: Festival, artistId: string) => festival.lineup.includes(artistId);

/** The festivals an artist plays, in the order given. */
export const festivalsOf = (festivals: Festival[], artistId: string) => festivals.filter((f) => playsAt(f, artistId));

/** Clips of artists on the festival's lineup, in catalogue order. */
export const lineupClips = (festival: Festival, clips: Clip[]) => {
  const on = new Set(festival.lineup);
  return clips.filter((c) => on.has(c.artistId));
};

/**
 * How many clips each festival's lineup has, counted from one pass over the
 * clips (asking every festival about every clip took seconds with a big
 * catalogue). Same numbers as `lineupClips(f, clips).length`.
 */
function lineupClipCounts(festivals: Festival[], clips: Clip[]): number[] {
  const perArtist = new Map<string, number>();
  for (const c of clips) perArtist.set(c.artistId, (perArtist.get(c.artistId) ?? 0) + 1);
  return festivals.map((f) => {
    let n = 0;
    for (const id of new Set(f.lineup)) n += perArtist.get(id) ?? 0;
    return n;
  });
}

/**
 * The festival Discover opens on: the one with the most clips to show (the
 * first of them on a tie), so a festival with only a clip or two doesn't
 * greet you with a near-empty feed. Its own "Discover the lineup" still works.
 */
export function defaultFocus(festivals: Festival[], clips: Clip[]): Festival | undefined {
  let best: Festival | undefined;
  let most = 0;
  const counts = lineupClipCounts(festivals, clips);
  for (const [i, f] of festivals.entries()) {
    const n = counts[i];
    if (n > most) {
      best = f;
      most = n;
    }
  }
  return best ?? festivals[0];
}

/**
 * Which festival to focus on to play this clip. Stays on the current one if
 * the artist plays it; otherwise the clip's own festival if the artist plays
 * there, otherwise the first festival that has them. Undefined when the
 * artist plays nowhere we know of, so the clip can't be reached from Discover.
 */
export function focusForClip(clip: Clip, current: Festival | undefined, festivals: Festival[]): Festival | undefined {
  if (current && playsAt(current, clip.artistId)) return current;
  const own = festivals.find((f) => f.id === clip.festivalId);
  if (own && playsAt(own, clip.artistId)) return own;
  return festivals.find((f) => playsAt(f, clip.artistId));
}

/**
 * Where Discover's focus should be, given what it was asked to open: a
 * festival (from its page) wins, then whatever festival a requested clip
 * needs, otherwise it stays where it is.
 */
export function nextFocus(
  current: Festival | undefined,
  asked: { festival?: Festival; clip?: Clip },
  festivals: Festival[],
): Festival | undefined {
  if (asked.festival) return asked.festival;
  if (asked.clip) return focusForClip(asked.clip, current, festivals) ?? current;
  return current;
}

/**
 * The artist's place at the festival, for the line under a clip. Works in
 * both phases: their set once times are out, otherwise that they're on the
 * lineup. Undefined if they don't play it.
 */
export function festivalLine(festival: Festival, artistId: string): string | undefined {
  if (!playsAt(festival, artistId)) return undefined;
  const set = setFor(festival, artistId);
  const day = dayList(daysOf(festival, artistId));
  const when = set ? describeSet(festival, set) : day ? `${day}, set time to come` : 'On the lineup, set time to come';
  return setLine(when, festival.notes?.[artistId]);
}

/** How many clips and artists Discover has for a festival's lineup. */
export function lineupReach(festival: Festival, clips: Clip[]) {
  const shown = lineupClips(festival, clips);
  return { clips: shown.length, artists: new Set(shown.map((c) => c.artistId)).size };
}

/** Other festivals worth discovering next: ones with clips to show, most clips first. */
export function otherFestivalsWithClips(festivals: Festival[], clips: Clip[], currentId: string | undefined, max = 2) {
  const others = festivals.filter((f) => f.id !== currentId);
  const counts = lineupClipCounts(others, clips);
  return others
    .map((f, i) => ({ f, i, n: counts[i] }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, max)
    .map((x) => x.f);
}
