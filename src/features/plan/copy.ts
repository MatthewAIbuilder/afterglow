import { SOUND_LABEL, type Artist } from '../../data/types';
import type { Catch, ClashVerdict, ExploreReason, Pick, Tier } from './plan';

/**
 * An artist's name inside a sentence: exactly as the lineup writes it.
 * Guessing capitals from an all-caps poster name goes wrong too often
 * ("The Xx", "Dj Snake", "Lp"), so names stay as the artist styles them.
 */
export const plainName = (a: Artist) => a.name;

export const pct = (match: number) => `${Math.round(match * 100)}%`;

/** The number to show, or "New" when the match would only be a guess. */
export const matchLabel = (p: Pick) => (p.known ? pct(p.match) : 'New');

export const TIER_LABEL: Record<Tier, string> = {
  'must-see': 'Must see',
  strong: 'Strong match',
  explore: 'Explore',
};

export const TIER_HINT: Record<Tier, string> = {
  'must-see': 'Your top matches, plus anyone you star.',
  strong: 'Very likely your thing.',
  explore: 'Outside your usual, worth a listen.',
};

/** Under a shortened explore list. */
export const moreToExplore = (n: number) => `${n} more to explore in the full lineup below.`;

export function exploreLine(reason: ExploreReason, free = false) {
  switch (reason.kind) {
    case 'unknown':
      return free ? "New to you, and you're free then." : "New to you. We don't know your take yet.";
    case 'near':
      return free
        ? `Close to ${plainName(reason.to)}'s sound, and you're free then.`
        : `Close to ${plainName(reason.to)}'s sound.`;
    case 'new-sound': {
      const sound = reason.sound ? SOUND_LABEL[reason.sound].toLowerCase() : null;
      if (free)
        return sound
          ? `Try some ${sound}. Nothing on your list clashes.`
          : 'A new sound for you, and nothing on your list clashes.';
      return sound ? `A new direction for you: ${sound}.` : 'A new direction from your usual sound.';
    }
  }
}

const duration = (min: number) => {
  if (min === 60) return 'hour';
  if (min % 60 === 0) return `${min / 60} hours`;
  return `${min} minutes`;
};

export function catchLine(c: Catch) {
  const part = c.when === 'before' ? 'first' : 'last';
  return `You can still catch the ${part} ${duration(c.minutes)} of ${plainName(c.pick.artist)}.`;
}

/** Headline and a softer second line for a clash. */
export function verdictLines(v: ClashVerdict): { head: string; sub: string } {
  switch (v.kind) {
    case 'pinned':
      return {
        head: `${plainName(v.pick.artist)} is on your must-see list.`,
        sub: v.other.known
          ? `${plainName(v.other.artist)} is a ${pct(v.other.match)} match if you change your mind.`
          : `${plainName(v.other.artist)} is on too, if you change your mind.`,
      };
    case 'clear':
      return {
        head: `${plainName(v.pick.artist)} is the stronger match for you.`,
        sub: `${Math.round(v.lead * 100)} points ahead on your taste.`,
      };
    case 'close':
      return {
        head: 'Close call. Both are strong matches.',
        sub: "Go with whoever you'd hate to miss most.",
      };
  }
}
