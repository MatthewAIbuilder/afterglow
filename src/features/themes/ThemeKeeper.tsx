import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useSocial } from '../../state/social';
import { useSprouts } from '../../state/sprouts';
import { useWelcomed } from '../../state/welcome';
import { THEME_ID } from '../../theme/tokens';
import { writeStoredTheme } from '../../theme/storedTheme';
import { useStanding } from '../standing/useStanding';
import { giftToShow } from './gifts';
import { cleanOffered, giftDue, themeToRevert } from './themes';

export const THEME_GIFT_KEY = 'themeGift.v1';
const TABS = new Set(['/', '/sound', '/festivals', '/together', '/profile']);

/**
 * Keeps the app's theme honest, and hands out the ones made for someone.
 * A Plus theme goes back to Afterglow once Plus has ended, and a theme made
 * for one person goes back when someone else signs in (both on the next
 * start: nothing changes under your thumb). The person a theme was made
 * for is offered it once, over a tab, with the theme page. A gift theme
 * that came with a sprout is shown once too: put straight on for a brand-new
 * account once its profile is made, offered to one that already had a
 * profile (features/themes/gifts.ts). Renders nothing.
 */
export function ThemeKeeper() {
  const social = useSocial();
  const uid = social.user?.uid;
  const standing = useStanding(uid);
  const plus = uid && standing ? !!standing.plus : undefined;

  const sprouts = useSprouts();
  // Gifts are known once the garden is loaded and the profile read (the developer's gifts come from their handle).
  const giftsKnown = sprouts.hydrated && social.profileStatus === 'ready';
  const gifts = giftsKnown ? sprouts.giftThemes.map((g) => g.theme) : undefined;
  const giftKey = gifts?.join(',');
  useEffect(() => {
    const back = themeToRevert(THEME_ID, { uid, plus, gifts: giftKey === undefined ? undefined : giftKey.split(',').filter(Boolean) });
    if (back) writeStoredTheme(back);
  }, [uid, plus, giftKey]);

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

  // A gift theme that came with a sprout: shown once, over a tab.
  const next = giftsKnown ? giftToShow(sprouts.giftThemes, THEME_ID, !!social.profile) : undefined;
  const { giftThemeShown } = sprouts;
  const nextSprout = next?.sprout;
  const nextTheme = next?.theme;
  const nextWear = !!next?.wear;
  const nextAlready = !!next?.already;
  useEffect(() => {
    if (!nextSprout || !nextTheme || !nav?.key || !onTab || !welcomed) return;
    if (nextAlready) {
      giftThemeShown(nextSprout);
      return;
    }
    const timer = setTimeout(() => {
      giftThemeShown(nextSprout);
      router.push({ pathname: '/themes', params: { gift: nextTheme, ...(nextWear ? { wear: '1' } : {}) } });
    }, 900);
    return () => clearTimeout(timer);
  }, [nextSprout, nextTheme, nextWear, nextAlready, nav?.key, onTab, welcomed, giftThemeShown]);
  return null;
}
