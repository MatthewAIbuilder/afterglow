import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { useWeekends } from '../../state/weekends';
import { festivalReminders, reminderChanges } from './reminders';

// While the app is open, a reminder still shows as a banner (quietly). Phones only.
if (Platform.OS !== 'web') Notifications.setNotificationHandler({
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
 * permission right after you tap "I'm going" (never just because the app
 * opened). Tapping a reminder opens the festival.
 * Renders nothing; lives in the root layout. Phones only (the web has no
 * local notifications).
 */
export function ReminderSync() {
  return Platform.OS === 'web' ? null : <PhoneReminders />;
}

function PhoneReminders() {
  const { festivals: all } = useCatalog();
  const { going, hydrated } = useGoing();
  // Your weekend of a two-weekend festival: reminders for that one only.
  const { forYou, hydrated: weekendsLoaded } = useWeekends();
  const festivals = useMemo(() => all.map(forYou), [all, forYou]);
  const syncing = useRef(Promise.resolve());
  // The sync when the app opens never asks for permission out of the blue; only a change you make
  // (tapping "I'm going") does.
  const opened = useRef(true);

  useEffect(() => {
    if (!hydrated || !weekendsLoaded) return;
    const mayAsk = !opened.current;
    opened.current = false;
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
        if (status !== 'granted' && canAskAgain && mayAsk) ({ status } = await Notifications.requestPermissionsAsync());
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
  }, [festivals, going, hydrated, weekendsLoaded]);

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
