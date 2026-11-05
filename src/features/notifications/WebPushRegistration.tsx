import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { LANGUAGE } from '../../i18n';
import { useSocial } from '../../state/social';
import { PUSH_REGISTERED_KEY, readPushRegistered, type PushRegistered } from './push';
import { browserSubscription, webPushPermission } from './webPush';

/**
 * Once this browser has said yes to notifications (NotifyCard), keeps its
 * address in your crews and chats, the same as a phone (PushRegistration):
 * on launch, when you join a room and once a day. Renders nothing; the
 * website only, and only once web push is set up (docs/web-push.md).
 */
export function WebPushRegistration() {
  const { user, service, availability } = useSocial();
  const uid = user?.uid;

  useEffect(() => {
    if (Platform.OS !== 'web' || !uid || !availability.ok || webPushPermission() !== 'granted') return;
    let live = true;
    const wait = setTimeout(() => {
      void (async () => {
        const sub = await browserSubscription(false);
        if (!sub || !live) return;
        const token = await service.webPushSubscribe(sub);
        if (!token || !live) return;
        const mark: PushRegistered = { uid, token, lang: LANGUAGE, rooms: '', day: new Date().toDateString() };
        const last = readPushRegistered(await AsyncStorage.getItem(PUSH_REGISTERED_KEY));
        if (last && JSON.stringify(last) === JSON.stringify(mark)) return;
        await service.registerPush(token, LANGUAGE);
        await AsyncStorage.setItem(PUSH_REGISTERED_KEY, JSON.stringify(mark));
      })().catch(() => {});
    }, 2500);
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [uid, availability.ok, service]);

  return null;
}
