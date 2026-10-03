import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useGoing } from '../../state/going';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { useWelcomed } from '../../state/welcome';
import { useTonight } from '../tonight/useTonight';
import { showWhatsNew, WHATS_NEW } from './whatsNew';

export const WHATS_NEW_KEY = 'whatsNew.v1';
const TABS = new Set(['/', '/sound', '/festivals', '/together', '/profile']);

/**
 * Opens "What's new" once after an update, over a tab, for people who were
 * already using the app (not on a festival night, when Tonight opens
 * instead). Screen tests leave it off unless they ask. Renders nothing.
 */
let inTests = false;
/** Screen tests leave the launcher off; one test turns it on. */
export const showWhatsNewInTests = (on: boolean) => {
  inTests = on;
};

export function WhatsNewLauncher() {
  const nav = useRootNavigationState();
  const onTab = TABS.has(usePathname());
  const { welcomed } = useWelcomed();
  const { going, hydrated: goingLoaded } = useGoing();
  const { reactions, hydrated: reacted } = useReactions();
  const { ratings, hydrated: rated } = useRatings();
  const tonight = useTonight();
  const done = useRef(false);
  const off = process.env.NODE_ENV === 'test' && !inTests;
  const ready = !off && !!nav?.key && welcomed && goingLoaded && reacted && rated && onTab && !tonight;
  const usedBefore = going.length > 0 || Object.keys(reactions).length > 0 || Object.keys(ratings).length > 0;

  // Someone new (the welcome is still to come) sees everything fresh: this update's list is never news to them.
  useEffect(() => {
    if (!off && welcomed === false) AsyncStorage.setItem(WHATS_NEW_KEY, WHATS_NEW.key).catch(() => {});
  }, [welcomed, off]);

  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    AsyncStorage.getItem(WHATS_NEW_KEY)
      .then((seen) => {
        AsyncStorage.setItem(WHATS_NEW_KEY, WHATS_NEW.key).catch(() => {});
        if (showWhatsNew(seen, usedBefore)) setTimeout(() => router.push('/whats-new'), 600);
      })
      .catch(() => {});
  }, [ready, usedBefore]);
  return null;
}
