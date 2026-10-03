import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useGoing } from '../../state/going';
import { useWelcomed } from '../../state/welcome';
import { tonightKey } from './tonight';
import { useTonight } from './useTonight';

export const TONIGHT_KEY = 'tonightShown.v1';

/** Tonight only opens over one of the five tabs, never in the middle of something (filming, tagging, a sheet). */
const TABS = new Set(['/', '/lineup', '/sound', '/festivals', '/together', '/profile']);

/**
 * On a festival night, the first time you open the app that night, Tonight
 * opens by itself (once a night; never before the welcome, never on top of
 * it, and only over one of the tabs: a night that begins while you're
 * filming waits until you're back). Renders nothing.
 */
export function TonightLauncher() {
  const nav = useRootNavigationState();
  const onTab = TABS.has(usePathname());
  const { welcomed } = useWelcomed();
  const { hydrated } = useGoing();
  const tonight = useTonight();
  const handled = useRef<string | undefined>(undefined);
  const key = tonight ? tonightKey(tonight.festival.id, tonight.at) : undefined;

  useEffect(() => {
    if (!nav?.key || !welcomed || !hydrated || !onTab || !key || handled.current === key) return;
    handled.current = key;
    AsyncStorage.getItem(TONIGHT_KEY)
      .then((last) => {
        if (last === key) return;
        AsyncStorage.setItem(TONIGHT_KEY, key).catch(() => {});
        router.push('/tonight');
      })
      .catch(() => {});
  }, [nav?.key, welcomed, hydrated, onTab, key]);
  return null;
}
