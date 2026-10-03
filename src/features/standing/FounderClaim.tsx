import { useEffect, useRef } from 'react';
import { useSocial } from '../../state/social';
import { rememberStanding } from './useStanding';

/**
 * Claims a founder spot for you, once per session, as soon as you have a
 * profile: the first 100 people get a number, in the order they arrive.
 * Renders nothing. A failed try (no signal) tries again next time the app
 * opens.
 */
export function FounderClaim() {
  const social = useSocial();
  const uid = social.user?.uid;
  const has = !!social.profile;
  const tried = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!social.availability.ok || !uid || !has || tried.current === uid) return;
    tried.current = uid;
    Promise.all([social.service.claimFounder(), social.service.standingOf(uid)])
      .then(([n, s]) => rememberStanding(uid, { ...s, ...(n ? { founder: n } : {}) }))
      .catch(() => {
        tried.current = undefined;
      });
  }, [social.availability.ok, uid, has, social.service]);
  return null;
}
