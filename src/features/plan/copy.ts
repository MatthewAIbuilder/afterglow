import { SOUND_LABEL, type Artist } from '../../data/types';
import { t } from '../../i18n';
import type { Catch, ClashVerdict, ExploreReason, Pick, Tier } from './plan';

/**
 * An artist's name inside a sentence: exactly as the lineup writes it.
 * Guessing capitals from an all-caps poster name goes wrong too often
 * ("The Xx", "Dj Snake", "Lp"), so names stay as the artist styles them.
 */
export const plainName = (a: Artist) => a.name;

export const pct = (match: number) => `${Math.round(match * 100)}%`;

/** The number to show, or "New" when the match would only be a guess. */
export const matchLabel = (p: Pick) => (p.known ? pct(p.match) : t('New'));

export const TIER_LABEL: Record<Tier, string> = {
  'must-see': t('Must see'),
  strong: t('Strong match'),
  explore: t('Explore'),
};

export const TIER_HINT: Record<Tier, string> = {
  'must-see': t('Your top matches, plus anyone you star.'),
  strong: t('Very likely your thing.'),
  explore: t('Outside your usual, worth a listen.'),
};

/** Under a shortened explore list. */
export const moreToExplore = (n: number) => t('{n} more to explore in the Lineup tab.', { n });

export function exploreLine(reason: ExploreReason, free = false) {
  switch (reason.kind) {
    case 'unknown':
      return free ? t("New to you, and you're free then.") : t('Not rated yet.');
    case 'near':
      return free
        ? t("Close to {name}'s sound, and you're free then.", { name: plainName(reason.to) })
        : t("Close to {name}'s sound.", { name: plainName(reason.to) });
    case 'new-sound': {
      const sound = reason.sound ? SOUND_LABEL[reason.sound].toLowerCase() : null;
      if (free)
        return sound
          ? t('Try some {sound}. Nothing on your list clashes.', { sound })
          : t('A new sound for you, and nothing on your list clashes.');
      return sound ? t('A new direction for you: {sound}.', { sound }) : t('A new direction from your usual sound.');
    }
  }
}

export function catchLine(c: Catch) {
  const name = plainName(c.pick.artist);
  const n = c.minutes / 60;
  if (c.when === 'before') {
    if (c.minutes === 60) return t('You can still catch the first hour of {name}.', { name });
    if (c.minutes % 60 === 0) return t('You can still catch the first {n} hours of {name}.', { n, name });
    return t('You can still catch the first {n} minutes of {name}.', { n: c.minutes, name });
  }
  if (c.minutes === 60) return t('You can still catch the last hour of {name}.', { name });
  if (c.minutes % 60 === 0) return t('You can still catch the last {n} hours of {name}.', { n, name });
  return t('You can still catch the last {n} minutes of {name}.', { n: c.minutes, name });
}

/** Headline and a softer second line for a clash. */
export function verdictLines(v: ClashVerdict): { head: string; sub: string } {
  switch (v.kind) {
    case 'pinned':
      return {
        head: t('{name} is on your must-see list.', { name: plainName(v.pick.artist) }),
        sub: v.other.known
          ? t('{name} is a {match} match if you change your mind.', { name: plainName(v.other.artist), match: pct(v.other.match) })
          : t('{name} is on too, if you change your mind.', { name: plainName(v.other.artist) }),
      };
    case 'clear':
      return {
        head: t('{name} is the stronger match for you.', { name: plainName(v.pick.artist) }),
        sub: t('{n} points ahead on your taste.', { n: Math.round(v.lead * 100) }),
      };
    case 'close':
      return {
        head: t('Close call. Both are strong matches.'),
        sub: t("Go with whoever you'd hate to miss most."),
      };
  }
}
