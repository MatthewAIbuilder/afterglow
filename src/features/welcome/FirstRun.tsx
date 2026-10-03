import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useGoing } from '../../state/going';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { useSeen } from '../../state/seen';
import { useWelcomed } from '../../state/welcome';
import { isNewcomer } from './firstRun';

/**
 * Opens the welcome once, on a first run. Waits until navigation is ready
 * and everything saved has loaded, so it never mistakes someone who has used
 * the app for a newcomer. Someone who arrives on a link (a crew invite, a
 * profile, a festival) sees that first: the welcome waits until they're on
 * one of the tabs. Renders nothing.
 */
/** The tabs the welcome may open over. */
const WELCOME_OVER = new Set(['/', '/lineup', '/sound', '/festivals', '/together', '/profile']);

export function FirstRun() {
  const nav = useRootNavigationState();
  const { welcomed, markWelcomed } = useWelcomed();
  const { reactions, hydrated: reactionsLoaded } = useReactions();
  const { ratings, hydrated: ratingsLoaded } = useRatings();
  const { going, hydrated: goingLoaded } = useGoing();
  const { seen, hydrated: seenLoaded } = useSeen();
  const checked = useRef(false);
  const onTab = WELCOME_OVER.has(usePathname());

  const ready = !!nav?.key && welcomed !== undefined && reactionsLoaded && ratingsLoaded && goingLoaded && seenLoaded;
  useEffect(() => {
    if (!ready || checked.current) return;
    // Not over a link someone opened: wait for a tab (unless they've used the app before).
    if (!welcomed && !onTab && isNewcomer({ reactions: Object.keys(reactions).length, ratings: Object.keys(ratings).length, going: going.length, seen: Object.keys(seen).length })) return;
    checked.current = true;
    if (welcomed) return;
    const history = {
      reactions: Object.keys(reactions).length,
      ratings: Object.keys(ratings).length,
      going: going.length,
      seen: Object.keys(seen).length,
    };
    // Someone who has used the app before: never show it, even after a Start over.
    if (!isNewcomer(history)) markWelcomed();
    else router.push('/welcome');
  }, [ready, onTab, welcomed, reactions, ratings, going, seen, markWelcomed]);

  return null;
}
