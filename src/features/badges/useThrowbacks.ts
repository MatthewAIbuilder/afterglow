import { useMemo } from 'react';
import { useMemories } from '../../state/memories';
import { useSocial } from '../../state/social';
import { throwbackBadges, type ThrowbackBadge } from './badges';
import { useBadges } from './useBadges';

/** A throwback badge, and whether its first video is a shared one (else it's in your Memories on this phone). */
export type ThrowbackEntry = ThrowbackBadge & { shared: boolean };

/**
 * Someone's throwback badges (past festivals, added from the camera roll).
 * Yours come from the videos on this phone, so they're yours without sharing
 * anything, plus any you shared from another phone; anyone else's from what
 * they've shared.
 */
export function useThrowbacks(uid: string | undefined): ThrowbackEntry[] {
  const social = useSocial();
  const mine = !uid || uid === social.user?.uid;
  const { memories } = useMemories();
  const { throwbacks: shared } = useBadges(uid ?? social.user?.uid);
  return useMemo(() => {
    const own = mine ? throwbackBadges(memories).map((t) => ({ ...t, shared: false })) : [];
    const have = new Set(own.map((t) => t.key));
    return [...own, ...shared.filter((t) => !have.has(t.key)).map((t) => ({ ...t, shared: true }))].sort(
      (a, b) => b.past.year - a.past.year || b.earnedAt.localeCompare(a.earnedAt),
    );
  }, [mine, memories, shared]);
}
