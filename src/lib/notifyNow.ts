import * as Notifications from 'expo-notifications';

/**
 * A notification on this phone right now (a friend you scanned with no
 * signal went through), only if notifications are already allowed: this
 * never asks. Tapping it opens `href`.
 */
export async function notifyNow(id: string, title: string, body: string, href: string): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({ identifier: id, content: { title, body, data: { href } }, trigger: null });
  } catch {
    // Not important enough to bother anyone about.
  }
}
