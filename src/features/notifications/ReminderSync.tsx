import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { festivalReminders, reminderChanges } from './reminders';

// While the app is open, a reminder still shows as a banner (quietly).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Keeps the phone's scheduled reminders in step with the festivals you're
 * going to (a week before and the day before; see reminders.ts). Asks for
 * permission the first time there's something to remind you of, which is
 * right after you tap "I'm going". Tapping a reminder opens the festival.
 * Renders nothing; lives in the root layout.
 */
export function ReminderSync() {
  const { festivals } = useCatalog();
  const { going, hydrated } = useGoing();
  const syncing = useRef(Promise.resolve());

  useEffect(() => {
    if (!hydrated) return;
    // One sync at a time, in order, so quick taps never double-schedule.
    syncing.current = syncing.current.then(async () => {
      try {
        const wanted = festivalReminders(festivals, going, new Date());
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        const { cancel, schedule } = reminderChanges(
          wanted,
          scheduled.map((n) => n.identifier),
        );
        for (const id of cancel) await Notifications.cancelScheduledNotificationAsync(id);
        if (!schedule.length) return;
        let { status, canAskAgain } = await Notifications.getPermissionsAsync();
        if (status !== 'granted' && canAskAgain) ({ status } = await Notifications.requestPermissionsAsync());
        if (status !== 'granted') return;
        for (const r of schedule) {
          await Notifications.scheduleNotificationAsync({
            identifier: r.id,
            content: { title: r.title, body: r.body, data: { festivalId: r.festivalId } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
          });
        }
      } catch {
        // Reminders are a nicety: never let them get in the way.
      }
    });
  }, [festivals, going, hydrated]);

  // Opened from a reminder: go to that festival (once per reminder).
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | undefined>(undefined);
  useEffect(() => {
    const id = response?.notification.request.identifier;
    const festivalId = response?.notification.request.content.data?.festivalId;
    if (!id || handled.current === id || typeof festivalId !== 'string') return;
    handled.current = id;
    // Let navigation settle first when the app was opened by the tap.
    const t = setTimeout(() => router.push(`/festival/${festivalId}`), 300);
    return () => clearTimeout(t);
  }, [response]);

  return null;
}
