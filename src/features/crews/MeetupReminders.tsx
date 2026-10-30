import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useCrews } from '../../state/crews';
import { MEETUP_PREFIX, meetupReminders, upcomingMeetups } from './meetups';

/** The phone keeps at most 64 scheduled notifications for an app; meetups take at most this many. */
const MEETUP_REMINDERS_MAX = 10;

/**
 * Reminds you before each of your crews' meetups (15 minutes before, and at
 * the time), scheduled on this phone from what it last read, so they arrive
 * with no signal. Never asks for permission (the set reminders do that).
 * Draws nothing; not on the website.
 */
export function MeetupReminders() {
  return Platform.OS === 'web' ? null : <PhoneMeetupReminders />;
}

function PhoneMeetupReminders() {
  const { allMeetups } = useCrewUpdates();
  const { crews } = useCrews();
  const key = `${allMeetups.map(({ crewId, meetup }) => `${crewId}:${meetup.id}:${meetup.at}:${meetup.place}`).join('|')}#${crews.map((c) => `${c.id}:${c.name}`).join('|')}`;
  const syncing = useRef(Promise.resolve());

  useEffect(() => {
    syncing.current = syncing.current.then(async () => {
      try {
        const now = Date.now();
        const names = new Map(crews.map((c) => [c.id, c.name]));
        const coming = allMeetups.filter(({ meetup }) => upcomingMeetups([meetup], now).length);
        const wanted = meetupReminders(
          coming.map(({ crewId, meetup }) => ({ crewId, crewName: names.get(crewId) ?? '', meetup })),
          new Date(now),
        ).slice(0, MEETUP_REMINDERS_MAX);
        const scheduled = (await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier).filter((id) => id.startsWith(MEETUP_PREFIX));
        const want = new Set(wanted.map((r) => r.id));
        for (const id of scheduled) if (!want.has(id)) await Notifications.cancelScheduledNotificationAsync(id);
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;
        const have = new Set(scheduled);
        for (const r of wanted) {
          if (have.has(r.id)) continue;
          await Notifications.scheduleNotificationAsync({
            identifier: r.id,
            content: { title: r.title, body: r.body, data: { href: r.href } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
          });
        }
      } catch {
        // Reminders are a nicety.
      }
    });
    // key stands for the meetups and crew names.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
