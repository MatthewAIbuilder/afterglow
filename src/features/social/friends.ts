import type { Festival } from '../../data/models';
import { WEB_URL } from '../../config/app';
import type { Profile } from './models';

/**
 * The Friends hub, pure: who follows you that you don't follow back, people
 * going to your festivals you might know, and what an invite says.
 */

type Known = { following: ReadonlySet<string>; blocked: ReadonlySet<string>; me?: string };

/** At most this many suggestions of each kind. */
export const SUGGEST_MAX = 8;

/** People following you whom you don't follow back (never blocked, never you), in the order given (newest first). */
export function followBack(followers: readonly string[], { following, blocked, me }: Known, max = SUGGEST_MAX): string[] {
  const seen = new Set<string>();
  return followers
    .filter((uid) => uid !== me && !following.has(uid) && !blocked.has(uid) && !seen.has(uid) && (seen.add(uid), true))
    .slice(0, max);
}

export type GoerSuggestion = { profile: Profile; festival: Festival };

/**
 * People going to your festivals whom you don't follow yet: soonest festival
 * first, each person once (at their first festival), A to Z within a
 * festival. Never you or anyone blocked.
 */
export function goerSuggestions(
  byFestival: readonly { festival: Festival; profiles: readonly Profile[] }[],
  { following, blocked, me }: Known,
  max = SUGGEST_MAX,
): GoerSuggestion[] {
  const seen = new Set<string>();
  const out: GoerSuggestion[] = [];
  for (const { festival, profiles } of byFestival) {
    const fresh = [...profiles]
      .filter((p) => p.uid !== me && !following.has(p.uid) && !blocked.has(p.uid) && !seen.has(p.uid))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    for (const p of fresh) {
      seen.add(p.uid);
      out.push({ profile: p, festival });
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** What "Invite friends" sends: who you are and where to find you. */
export function inviteText(handle?: string, festival?: Festival): string {
  const where = festival ? ` Let's plan ${festival.name} together.` : ' Find your sets, plan festivals together and see where your crew is.';
  return handle
    ? `Join me on Afterglow, I'm @${handle}.${where}\n${WEB_URL}/u/${handle}`
    : `Join me on Afterglow.${where}\n${WEB_URL}`;
}

/** "3 of you", "Just you so far". */
export const crewPeopleLine = (members: number) => (members <= 1 ? 'Just you so far' : `${members} of you`);
