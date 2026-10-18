import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { LANGUAGE } from '../../i18n';
import { useCrewChat } from '../../state/crewChat';
import { useCrews } from '../../state/crews';
import { useSocial } from '../../state/social';
import { PUSH_REGISTERED_KEY, readPushRegistered, type PushRegistered } from './push';

/** Asked once for notifications because you're in a crew or chat (the phone's own prompt never comes twice anyway). */
const PUSH_ASKED_KEY = 'pushAsked.v1';

/**
 * Lets the people in your crews and chats reach this phone: once you're
 * signed in, this phone's push address goes into each of your crews and
 * 1-to-1 chats (and on its own, for invites and support replies), again when
 * you join one and once a day. Asks for permission once, the first time
 * you're in a crew or chat; never while you're in none. Renders nothing;
 * phones only (see push.ts). Signing out takes the address away again
 * (state/social.tsx).
 */
export function PushRegistration() {
  const { user, service, availability } = useSocial();
  const { crews } = useCrews();
  const { directChats } = useCrewChat();
  const uid = user?.uid;
  const rooms = useMemo(() => [...crews.map((c) => c.id), ...directChats.map((d) => d.id)].sort().join(','), [crews, directChats]);

  useEffect(() => {
    if (Platform.OS === 'web' || !uid || !availability.ok) return;
    let live = true;
    // A moment after things settle (crews and chats arrive one after another).
    const wait = setTimeout(() => {
      void (async () => {
        let { status, canAskAgain } = await Notifications.getPermissionsAsync();
        if (status !== 'granted' && canAskAgain && rooms && (await AsyncStorage.getItem(PUSH_ASKED_KEY)) !== 'yes') {
          await AsyncStorage.setItem(PUSH_ASKED_KEY, 'yes');
          ({ status } = await Notifications.requestPermissionsAsync());
        }
        if (status !== 'granted' || !live) return;
        const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
        const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
        if (!token || !live) return;
        const mark: PushRegistered = { uid, token, lang: LANGUAGE, rooms, day: new Date().toDateString() };
        const last = readPushRegistered(await AsyncStorage.getItem(PUSH_REGISTERED_KEY));
        if (last && JSON.stringify(last) === JSON.stringify(mark)) return;
        await service.registerPush(token, LANGUAGE);
        await AsyncStorage.setItem(PUSH_REGISTERED_KEY, JSON.stringify(mark));
      })().catch(() => {});
    }, 1500);
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [uid, rooms, availability.ok, service]);

  return null;
}
