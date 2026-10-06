import { useEffect } from 'react';
import { useSocial } from '../../state/social';
import type { OrgCounter } from './organizers';

/** Counted already while the app is open (`org/key`): a view is counted once a session, so going back and forth isn't ten views. */
const counted = new Set<string>();

/** For tests. */
export const forgetOrgViews = () => counted.clear();

/** Count something for an organizer's numbers, once a session (signed in only; a failed count is let go). */
export function countOrgOnce(service: { countOrgView: (orgId: string, key: OrgCounter) => Promise<void> }, orgId: string, key: OrgCounter, signedIn: boolean) {
  const k = `${orgId}/${key}`;
  if (!signedIn || counted.has(k)) return;
  counted.add(k);
  service.countOrgView(orgId, key).catch(() => counted.delete(k));
}

/** Counts a view of an organizer's page or event when this screen shows it. */
export function useOrgView(orgId: string | undefined, key: OrgCounter | undefined) {
  const { service, user } = useSocial();
  const signedIn = !!user;
  useEffect(() => {
    if (orgId && key) countOrgOnce(service, orgId, key, signedIn);
  }, [service, orgId, key, signedIn]);
}
