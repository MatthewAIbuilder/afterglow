import type { CrewInvite, Profile } from '../social/models';
import { matchesName } from '../festivals/search';
import type { Notice } from '../notifications/inbox';
import { t } from '../../i18n';

/**
 * Inviting people you know on Afterglow to a crew, and the invites you've
 * been sent. Pure, so it can be tested.
 */

export type InviteStatus = 'invite' | 'invited' | 'member';
export type InviteRow = { profile: Profile; status: InviteStatus; going: boolean };

/** The most people the invite list reads (people you follow and who follow you). */
export const INVITE_PEOPLE_MAX = 200;

/**
 * Who you can invite: people you follow or who follow you, never you or
 * anyone blocked, each once. People going to the crew's festival first, then
 * A to Z; crewmates listed last as already in. A search narrows by name or
 * handle.
 */
export function inviteCandidates(
  profiles: readonly Profile[],
  opts: { me?: string; members: readonly string[]; invited: ReadonlySet<string>; blocked: ReadonlySet<string>; festivalId: string; query?: string },
): InviteRow[] {
  const seen = new Set<string>();
  const q = (opts.query ?? '').trim().replace(/^@+/, '');
  const rows: InviteRow[] = [];
  for (const p of profiles) {
    if (seen.has(p.uid) || p.uid === opts.me || opts.blocked.has(p.uid)) continue;
    seen.add(p.uid);
    if (q && !matchesName(p.displayName, q) && !matchesName(p.handle, q)) continue;
    const status: InviteStatus = opts.members.includes(p.uid) ? 'member' : opts.invited.has(p.uid) ? 'invited' : 'invite';
    rows.push({ profile: p, status, going: (p.festivals ?? []).includes(opts.festivalId) });
  }
  const rank = (r: InviteRow) => (r.status === 'member' ? 2 : r.going ? 0 : 1);
  return rows.sort((a, b) => rank(a) - rank(b) || a.profile.displayName.localeCompare(b.profile.displayName));
}

/** "Maya invited you to Bass crew" (the crew's name, or "their crew"). */
export function inviteTitle(fromName: string | undefined, crewName: string): string {
  const name = fromName ?? t('Someone');
  return crewName.trim() ? t('{name} invited you to {crew}', { name, crew: crewName.trim() }) : t('{name} invited you to their crew', { name });
}

/** Invites still worth showing: not to crews you're already in, newest first, each crew once, nobody blocked. */
export function openInvites(invites: readonly CrewInvite[], opts: { myCrews: readonly string[]; blocked: ReadonlySet<string> }): CrewInvite[] {
  const seen = new Set<string>();
  return [...invites]
    .sort((a, b) => b.at.localeCompare(a.at))
    .filter((i) => {
      if (seen.has(i.crewId) || opts.myCrews.includes(i.crewId) || opts.blocked.has(i.from)) return false;
      seen.add(i.crewId);
      return true;
    });
}

/** Bell notices for invites still open: "Maya invited you to Bass crew" / "Plan Cyclops Cove 4 together.", opening the crew. */
export function inviteNotices(invites: readonly CrewInvite[], opts: { nameOf: (uid: string) => string | undefined; festivalName: (id: string) => string | undefined }): Notice[] {
  return invites.map((i) => ({
    id: `crewInvite:${i.crewId}:${i.at}`,
    kind: 'crewInvite' as const,
    title: inviteTitle(opts.nameOf(i.from), i.crewName),
    body: ((festival) => (festival ? t('Plan {festival} together. Tap to see the crew and join.', { festival }) : t('Plan the festival together. Tap to see the crew and join.')))(opts.festivalName(i.festivalId)),
    href: `/crew/${i.crewId}`,
    festivalId: i.festivalId,
  }));
}
