import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { useSocial } from '../../state/social';
import { useSprouts } from '../../state/sprouts';
import { useWelcomed } from '../../state/welcome';
import { sproutLinkParams } from './sprouts';

const TABS = new Set(['/', '/sound', '/festivals', '/together', '/profile']);

/**
 * A sprout that arrived in the background (scanned before signing up, or
 * picked up once there was signal) is shown once, over a tab, after your
 * profile is made: its page says who gave it and offers to follow them. One
 * from someone you already follow (or blocked) is just marked as seen.
 * Renders nothing.
 */
export function SproutFollowKeeper() {
  const social = useSocial();
  const { toAskFollow, followAsked, hydrated } = useSprouts();
  const nav = useRootNavigationState();
  const onTab = TABS.has(usePathname());
  const { welcomed } = useWelcomed();
  const ready = hydrated && !!social.profile && !!nav?.key && onTab && welcomed;
  const next = ready ? toAskFollow[0] : undefined;
  const known = !!next && (social.following.has(next.from) || social.blocked.has(next.from) || next.from === social.user?.uid);
  useEffect(() => {
    if (!next) return;
    if (known) {
      followAsked(next.id);
      return;
    }
    const timer = setTimeout(() => {
      followAsked(next.id);
      router.push({ pathname: '/sprout/[id]', params: { id: next.id, ...sproutLinkParams(next) } });
    }, 600);
    return () => clearTimeout(timer);
  }, [next, known, followAsked]);
  return null;
}
