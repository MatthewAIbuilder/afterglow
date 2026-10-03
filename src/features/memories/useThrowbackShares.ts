import { useEffect, useState } from 'react';
import { useSocial } from '../../state/social';
import { useStanding } from '../standing/useStanding';
import { type ThrowbackShares, throwbackShares } from './throwbackLimit';

/**
 * How many more throwbacks you can share: read once you're signed in (and
 * again when `ask` changes, e.g. the tagging sheet opening on a past festival).
 * Undefined until known; Plus members can always share.
 */
export function useThrowbackShares(ask: boolean): ThrowbackShares | undefined {
  const social = useSocial();
  const uid = social.user?.uid;
  const standing = useStanding(uid);
  const [used, setUsed] = useState<{ uid: string; n: number } | undefined>();
  useEffect(() => {
    if (!ask || !uid || !social.availability.ok) return;
    let live = true;
    social.service
      .throwbackUsage()
      .then((n) => live && setUsed({ uid, n }))
      // Unknown (no signal, or older database rules): don't stand in the way; the upload itself is checked.
      .catch(() => live && setUsed({ uid, n: 0 }));
    return () => {
      live = false;
    };
  }, [ask, uid, social.service, social.availability.ok]);
  if (!uid || used?.uid !== uid) return undefined;
  return throwbackShares({ plus: !!standing?.plus, used: used.n });
}
