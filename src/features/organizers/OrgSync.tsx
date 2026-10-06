import { useEffect } from 'react';
import { AppState } from 'react-native';
import { setMyOrg, setOrgs } from '../../state/orgs';
import { useSocial } from '../../state/social';

let refreshNow: (() => void) | undefined;
/** Read organizers' pages again now (after a save in the studio or HQ). */
export const refreshOrgs = () => refreshNow?.();

/**
 * Reads event organizers' pages when the app opens and each time it comes
 * back to the front, so a published event shows within minutes for everyone,
 * signed in or not; and which organizer the signed-in account runs, if any
 * (its studio still opens only once the email is confirmed).
 * A failed read keeps what the phone had. Renders nothing.
 */
export function OrgSync() {
  const { service, availability, user } = useSocial();
  const uid = user?.uid;
  const verified = !!user?.emailVerified;
  useEffect(() => {
    if (!availability.ok) return;
    let busy = false;
    const read = () => {
      if (busy) return;
      busy = true;
      Promise.all([
        service.orgs().then(setOrgs),
        uid ? service.myOrg().then((id) => setMyOrg(uid, id)) : Promise.resolve(setMyOrg(undefined, null)),
      ])
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
    };
    refreshNow = read;
    read();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && read());
    return () => {
      sub.remove();
      if (refreshNow === read) refreshNow = undefined;
    };
  }, [service, availability.ok, uid, verified]);
  return null;
}
