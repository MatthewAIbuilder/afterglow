import { useEffect, useState } from 'react';
import { useSocial } from '../../state/social';
import { useStanding } from '../standing/useStanding';
import { type ThrowbackShares, throwbackShares } from './throwbackLimit';

/**
 * How many more throwbacks you can share: read once you're signed in (and
 * again when `ask` changes, e.g. the tagging sheet opening on a past festival).
 * Undefined until known, and while it can't be read (no signal): unknown is
 * never taken for none used. Plus members can always share.
 */
export function useThrowbackShares(ask: boolean): ThrowbackShares | undefined {
  const social = useSocial();
  const uid = social.user?.uid;
  const standing = useStanding(uid);
  const [used, setUsed] = useState<{ uid: string; n: number | undefined } | undefined>();
  useEffect(() => {
    if (!ask || !uid || !social.availability.ok) return;
    let live = true;
    social.service
      .throwbackUsage()
      .then((n) => live && setUsed({ uid, n }))
      // Unknown (no signal, or older database rules): no count to show; the share itself is checked before it uploads.
      .catch(() => live && setUsed({ uid, n: undefined }));
    return () => {
      live = false;
    };
  }, [ask, uid, social.service, social.availability.ok]);
  if (standing?.plus) return throwbackShares({ plus: true, used: 0 });
  if (!uid || used?.uid !== uid || used.n === undefined) return undefined;
  return throwbackShares({ plus: false, used: used.n });
}
