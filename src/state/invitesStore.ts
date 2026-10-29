import type { Invitee } from '../features/invites/invites';

/**
 * The invite lists kept in memory (state/invites.tsx), per account, shared by
 * every screen that shows them. On their own, with no other imports, so the
 * test setup can forget them without loading the app's social code.
 */
export const invitesOf = new Map<string, Invitee[]>();
export const inviterOf = new Map<string, string | null>();
export const inviteListeners = new Set<() => void>();
export const notifyInvites = () => inviteListeners.forEach((l) => l());

/** For tests and a switch of account: forget what's loaded. */
export function forgetInvites() {
  invitesOf.clear();
  inviterOf.clear();
}
