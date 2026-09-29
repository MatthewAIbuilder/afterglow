import { setFor } from '../../data/festival';
import { describeSet } from './format';
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
export const lineupClips = (festival: Festival, clips: Clip[]) => clips.filter((c) => playsAt(festival, c.artistId));

/**
 * The festival Discover opens on: the one with the most clips to show (the
 * first of them on a tie), so a festival with only a clip or two doesn't
 * greet you with a near-empty feed. Its own "Discover the lineup" still works.
 */
export function defaultFocus(festivals: Festival[], clips: Clip[]): Festival | undefined {
  let best: Festival | undefined;
  let most = 0;
  for (const f of festivals) {
    const n = lineupClips(f, clips).length;
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
  return set ? describeSet(festival, set) : 'On the lineup, set time to come';
}

/** How many clips and artists Discover has for a festival's lineup. */
export function lineupReach(festival: Festival, clips: Clip[]) {
  const shown = lineupClips(festival, clips);
  return { clips: shown.length, artists: new Set(shown.map((c) => c.artistId)).size };
}
