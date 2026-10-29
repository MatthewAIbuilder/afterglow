import type { Festival } from '../../data/models';
import { WEB_URL } from '../../config/app';
import { friendLink, type FriendCard } from '../friends/qr';
import type { Profile } from './models';
import { t } from '../../i18n';

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

/**
 * What "Invite friends" sends: who you are and where to find you. An invite
 * to a festival links to that festival's page (where they can tap I'm going
 * and find you); otherwise to your profile, or the app.
 */
export function inviteText(handle?: string, festival?: Festival, card?: FriendCard): string {
  const where = festival ? ' ' + t("Let's plan {festival} together.", { festival: festival.name }) : ' ' + t('Find your sets, plan festivals together and see where your crew is.');
  // Your friend link when you have one: it makes you friends, and a friend who joins from it counts for your invite rewards (features/invites).
  const link = card ? friendLink(card) : festival ? `${WEB_URL}/festival/${festival.id}` : handle ? `${WEB_URL}/u/${handle}` : WEB_URL;
  return `${handle ? t("Join me on Afterglow, I'm @{handle}.", { handle }) : t('Join me on Afterglow.')}${where}\n${link}`;
}

/** "3 of you", "Just you so far". */
export const crewPeopleLine = (members: number) => (members <= 1 ? t('Just you so far') : t('{n} of you', { n: members }));

export type MayKnow = { profile: Profile; why: string };

/** How many people the Friends page suggests before "Show more". */
export const MAY_KNOW_SHOWN = 4;

/**
 * One list of people you may know: people who follow you that you don't
 * follow back first ("Follows you"), then people going to your festivals
 * ("Going to Cyclops Cove 4"), each once.
 */
export function peopleYouMayKnow(followsYou: readonly Profile[], goers: readonly GoerSuggestion[]): MayKnow[] {
  const seen = new Set<string>();
  const out: MayKnow[] = [];
  for (const p of followsYou) {
    if (seen.has(p.uid)) continue;
    seen.add(p.uid);
    out.push({ profile: p, why: t('Follows you') });
  }
  for (const g of goers) {
    if (seen.has(g.profile.uid)) continue;
    seen.add(g.profile.uid);
    out.push({ profile: g.profile, why: t('Going to {festival}', { festival: g.festival.name }) });
  }
  return out;
}
