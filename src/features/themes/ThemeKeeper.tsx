import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useSocial } from '../../state/social';
import { useWelcomed } from '../../state/welcome';
import { THEME_ID } from '../../theme/tokens';
import { writeStoredTheme } from '../../theme/storedTheme';
import { useStanding } from '../standing/useStanding';
import { cleanOffered, giftDue, themeToRevert } from './themes';

export const THEME_GIFT_KEY = 'themeGift.v1';
const TABS = new Set(['/', '/sound', '/festivals', '/together', '/profile']);

/**
 * Keeps the app's theme honest, and hands out the ones made for someone.
 * A Plus theme goes back to Afterglow once Plus has ended, and a theme made
 * for one person goes back when someone else signs in (both on the next
 * start: nothing changes under your thumb). The person a theme was made
 * for is offered it once, over a tab, with the theme page. Renders nothing.
 */
export function ThemeKeeper() {
  const social = useSocial();
  const uid = social.user?.uid;
  const standing = useStanding(uid);
  const plus = uid && standing ? !!standing.plus : undefined;

  useEffect(() => {
    const back = themeToRevert(THEME_ID, { uid, plus });
    if (back) writeStoredTheme(back);
  }, [uid, plus]);

  const nav = useRootNavigationState();
  const onTab = TABS.has(usePathname());
  const { welcomed } = useWelcomed();
  const asked = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!nav?.key || !onTab || !welcomed || !uid || asked.current === uid) return;
    asked.current = uid;
    AsyncStorage.getItem(THEME_GIFT_KEY)
      .then((raw) => {
        const offered = cleanOffered(raw ? JSON.parse(raw) : []);
        if (!giftDue(uid, THEME_ID, offered)) return;
        AsyncStorage.setItem(THEME_GIFT_KEY, JSON.stringify([...offered, uid])).catch(() => {});
        setTimeout(() => router.push({ pathname: '/themes', params: { gift: '1' } }), 900);
      })
      .catch(() => {});
  }, [nav?.key, onTab, welcomed, uid]);
  return null;
}
