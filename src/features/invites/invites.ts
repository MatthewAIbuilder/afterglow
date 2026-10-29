import type { FriendCard } from '../friends/qr';
import { cardFrom } from '../friends/qr';
import { t } from '../../i18n';

/**
 * Invite friends, and be rewarded for it (the user on 2026-10-29: "rewarding
 * features when inviting friends to incentivize people to share the app";
 * they chose badges and pins, and a month of Plus). Pure.
 *
 * Your invite link is your friend link (features/friends/qr.ts). Someone who
 * opens it and then makes a profile counts as your invite: the link is kept
 * on their phone (`PendingInvite`) until they have a profile, then recorded
 * once (Firestore `invites/{their uid}`: `by` you), and you become friends.
 * Each person counts once, for one inviter, never for themselves (the rules
 * check it).
 */

/** The rewards, by how many friends joined from your link. */
export const INVITE_TIERS = [
  { count: 1, key: 'plus-one' },
  { count: 10, key: 'bring-the-crew' },
  { count: 25, key: 'legend' },
] as const;
export type InviteTier = (typeof INVITE_TIERS)[number];

/** What each reward is, in plain words. */
export const tierReward = (tier: InviteTier): string =>
  tier.key === 'plus-one' ? t('the Plus One pin') : tier.key === 'bring-the-crew' ? t('a month of Afterglow Plus') : t('Legend status');

/** Where you are: rewards earned, the next one and how many more friends it takes. */
export function inviteProgress(count: number): { earned: InviteTier[]; next?: InviteTier; toGo: number; share: number } {
  const earned = INVITE_TIERS.filter((tier) => count >= tier.count);
  const next = INVITE_TIERS.find((tier) => count < tier.count);
  const from = earned.at(-1)?.count ?? 0;
  return {
    earned: [...earned],
    ...(next ? { next } : {}),
    toGo: next ? next.count - count : 0,
    share: next ? Math.max(0, Math.min(1, (count - from) / (next.count - from))) : 1,
  };
}

/** How long an opened invite link still counts, if they haven't made a profile yet. */
export const INVITE_WINDOW_MS = 7 * 24 * 3600 * 1000;

/** An invite link opened on this phone by someone without a profile yet. */
export type PendingInvite = { card: FriendCard; at: number };

/** Read back safely: a whole friend card, opened within the window. */
export function cleanPendingInvite(raw: unknown, now: number): PendingInvite | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as { card?: { handle?: unknown; uid?: unknown; code?: unknown; name?: unknown }; at?: unknown };
  const card = o.card ? cardFrom({ handle: o.card.handle, u: o.card.uid, c: o.card.code, n: o.card.name }) : undefined;
  if (!card || typeof o.at !== 'number' || o.at > now + 60_000 || now - o.at > INVITE_WINDOW_MS) return undefined;
  return { card, at: o.at };
}

/** Someone who joined from your link. */
export type Invitee = { uid: string; at: string };

/** Friends who joined since you last looked (ids you've seen), newest first. */
export function newInvitees(list: readonly Invitee[], seen: ReadonlySet<string>): Invitee[] {
  return list.filter((i) => !seen.has(i.uid)).sort((a, b) => b.at.localeCompare(a.at));
}

/** HQ: inviters who've reached a month of Plus, most invites first. */
export function plusEarners(counts: readonly { by: string; count: number }[]): { by: string; count: number }[] {
  const at = INVITE_TIERS.find((tier) => tier.key === 'bring-the-crew')!.count;
  return counts.filter((c) => c.count >= at).sort((a, b) => b.count - a.count);
}

/** Every invite as a count per inviter. */
export function countByInviter(invites: readonly { by: string }[]): { by: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const i of invites) counts.set(i.by, (counts.get(i.by) ?? 0) + 1);
  return [...counts].map(([by, count]) => ({ by, count })).sort((a, b) => b.count - a.count || a.by.localeCompare(b.by));
}
