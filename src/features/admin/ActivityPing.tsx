import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { VERSION_LINE } from '../../lib/version';
import { useSocial } from '../../state/social';
import { isSupportAccount } from './admin';
import { localDay, shouldPing } from './presence';

/**
 * Notes that a signed-in account opened the app (its `activity` record:
 * the day, the time, platform and version, never what anyone did), so the
 * support dashboard can count who's active and who's drifted away. On
 * sign-in and each time the app comes back to the front, at most every 15
 * minutes; a failed write (no signal) tries again next time. Never for the
 * support account itself. Renders nothing.
 */
export function ActivityPing() {
  const social = useSocial();
  const uid = social.user?.uid;
  const support = isSupportAccount(social.user);
  const hasProfile = !!social.profile;
  const last = useRef<{ uid: string; day: string; at: number; hasProfile: boolean } | undefined>(undefined);
  const busy = useRef(false);

  useEffect(() => {
    if (!social.availability.ok || !uid || support) return;
    const ping = () => {
      const now = new Date();
      const prev = last.current?.uid === uid ? last.current : undefined;
      if (busy.current || !shouldPing(prev, now, hasProfile)) return;
      busy.current = true;
      social.service
        .markActive({ platform: Platform.OS, version: VERSION_LINE, hasProfile, now })
        .then(() => {
          last.current = { uid, day: localDay(now), at: now.getTime(), hasProfile };
        })
        .catch(() => {})
        .finally(() => {
          busy.current = false;
        });
    };
    ping();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') ping();
    });
    return () => sub.remove();
  }, [social.availability.ok, uid, support, hasProfile, social.service]);
  return null;
}
