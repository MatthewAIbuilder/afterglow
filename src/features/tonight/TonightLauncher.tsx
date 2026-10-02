import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useGoing } from '../../state/going';
import { useWelcomed } from '../../state/welcome';
import { tonightKey } from './tonight';
import { useTonight } from './useTonight';

export const TONIGHT_KEY = 'tonightShown.v1';

/**
 * On a festival night, the first time you open the app that night, Tonight
 * opens by itself (once a night; never before the welcome, never on top of
 * it). Renders nothing.
 */
export function TonightLauncher() {
  const nav = useRootNavigationState();
  const { welcomed } = useWelcomed();
  const { hydrated } = useGoing();
  const tonight = useTonight();
  const handled = useRef<string | undefined>(undefined);
  const key = tonight ? tonightKey(tonight.festival.id, tonight.at) : undefined;

  useEffect(() => {
    if (!nav?.key || !welcomed || !hydrated || !key || handled.current === key) return;
    handled.current = key;
    AsyncStorage.getItem(TONIGHT_KEY)
      .then((last) => {
        if (last === key) return;
        AsyncStorage.setItem(TONIGHT_KEY, key).catch(() => {});
        router.push('/tonight');
      })
      .catch(() => {});
  }, [nav?.key, welcomed, hydrated, key]);
  return null;
}
