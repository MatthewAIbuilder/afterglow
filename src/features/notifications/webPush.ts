import { Platform } from 'react-native';
import { WEB_PUSH_URL } from '../../config/app';

/**
 * Notifications in the browser (the website installed on a home screen),
 * through Afterglow's own push sender (`worker/`, docs/web-push.md). Browser
 * side only: asking, subscribing, remembering. Off until `WEB_PUSH_URL` is set.
 */

/** This browser can show notifications from a website (on an iPhone: only once the site is on the home screen). */
export function webPushSupported(): boolean {
  return Platform.OS === 'web' && !!WEB_PUSH_URL && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** 'default' (not asked yet), 'granted' or 'denied'; undefined where it can't work. */
export function webPushPermission(): NotificationPermission | undefined {
  return webPushSupported() ? Notification.permission : undefined;
}

const keyBytes = (b64url: string) => {
  const raw = atob(b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '='));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/**
 * This browser's subscription as plain data (asks for permission first when `ask`, which a browser only
 * allows from a tap). Undefined when not allowed, unsupported, or the sender can't be reached.
 */
export async function browserSubscription(ask: boolean): Promise<PushSubscriptionJSON | undefined> {
  if (!webPushSupported()) return undefined;
  try {
    if (Notification.permission === 'default' && ask) await Notification.requestPermission();
    if (Notification.permission !== 'granted') return undefined;
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing.toJSON();
    const res = await fetch(`${WEB_PUSH_URL}/vapid`);
    const { publicKey } = (await res.json()) as { publicKey?: string };
    if (!publicKey) return undefined;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
    return sub.toJSON();
  } catch {
    return undefined;
  }
}
