import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { useCatalog } from '../../state/catalog';
import { useAllDayHours } from '../../state/dayHours';
import { useGoing } from '../../state/going';
import { usePlan } from '../../state/plan';
import { useSetReminders } from '../../state/setReminders';
import { useTaste } from '../../state/taste';
import { useWeekends } from '../../state/weekends';
import { festivalRoute } from '../plan/route';
import { festivalReminders, reminderChanges, type Reminder } from './reminders';
import { careReminders, feelReminders } from './careReminders';
import { questReminder } from './questReminder';
import { useQuestReminder } from '../../state/questReminder';
import { useDailyQuests } from '../quests/useDailyQuests';
import { useCare } from '../../state/care';
import { tonightFestival } from '../tonight/tonight';
import { canRemindSets, setReminders, soonest } from './setReminders';

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
 * going to (a week before and the day before; see reminders.ts) and, for
 * festivals you switched them on for, before each set on your full-day route
 * (setReminders.ts), which follow the route as your plan changes. Asks for
 * permission right after you tap "I'm going" or switch set reminders on
 * (never just because the app opened, or because a like moved your route).
 * Tapping a reminder opens the festival.
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
  // Set reminders follow your route, from your live taste and must-sees.
  const { on: remindSets, hydrated: setsLoaded, changed } = useSetReminders();
  const { artists } = useCatalog();
  const { taste, informed } = useTaste();
  const { mustSeesAt } = usePlan();
  // Your hours: no reminder for a set the route skips because you've left or are at dinner.
  const { all: hoursAt } = useAllDayHours();
  // Water reminders, if you switched them on, while a festival you're going to is on.
  const { care, hydrated: careLoaded } = useCare();
  // The 8 PM nudge for daily quests, if you asked for it.
  const nudge = useQuestReminder();
  const quests = useDailyQuests();
  const questsLeft = quests.ready ? quests.rows.length - quests.doneToday : 0;
  const routes = useMemo(
    () =>
      festivals
        // Only festivals you're still going to (stop going and their set reminders go too).
        .filter((f) => going.includes(f.id) && remindSets.has(f.id) && canRemindSets(f))
        .map((f) => ({ festival: f, route: festivalRoute({ festival: f, artists, taste, informed, pinned: mustSeesAt(f.id), hours: hoursAt[f.id] }) })),
    [festivals, going, remindSets, artists, taste, informed, mustSeesAt, hoursAt],
  );
  const sync = useCallback(
    (mayAsk: boolean) => {
      // One sync at a time, in order, so quick taps never double-schedule.
      syncing.current = syncing.current.then(async () => {
        try {
          const now = new Date();
          const sets: Reminder[] = soonest(routes.flatMap(({ festival, route }) => setReminders(festival, route, now)));
          const water = careReminders(care, tonightFestival(festivals, going, now)?.festival.id, now);
          const evening = quests.ready ? questReminder(nudge.on, now, questsLeft, quests.streak) : undefined;
          const wanted = [...festivalReminders(festivals, going, now), ...sets, ...water, ...feelReminders(care, now), ...(evening ? [evening] : [])];
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
              content: { title: r.title, body: r.body, data: { festivalId: r.festivalId, ...(r.href ? { href: r.href } : {}) } },
              trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
            });
          }
        } catch {
          // Reminders are a nicety: never let them get in the way.
        }
      });
    },
    [festivals, going, routes, care, nudge.on, questsLeft, quests.ready, quests.streak],
  );

  // Only a change you make may ask for permission: going, or the set reminders switch. Not the sync when the app
  // opens, and not a route that moved because you liked something.
  const asked = useRef<{ going: unknown; changed: number; water: unknown; feel: unknown; nudge: boolean } | undefined>(undefined);

  useEffect(() => {
    if (!hydrated || !weekendsLoaded || !setsLoaded || !careLoaded || !nudge.loaded) return;
    const first = !asked.current;
    const mayAsk =
      !first && (asked.current!.going !== going || asked.current!.changed !== changed || asked.current!.water !== care.waterEvery || asked.current!.feel !== care.feelEvery || asked.current!.nudge !== nudge.on);
    asked.current = { going, changed, water: care.waterEvery, feel: care.feelEvery, nudge: nudge.on };
    // Opening the app and your own changes sync at once; a route that moved (a burst of likes) a beat later, once.
    if (first || mayAsk) {
      sync(mayAsk);
      return;
    }
    const t = setTimeout(() => sync(false), 600);
    return () => clearTimeout(t);
  }, [going, hydrated, weekendsLoaded, setsLoaded, careLoaded, care.waterEvery, care.feelEvery, changed, sync, nudge.loaded, nudge.on]);


  // Opened from a reminder: go to that festival (once per reminder).
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | undefined>(undefined);
  useEffect(() => {
    const id = response?.notification.request.identifier;
    const data = response?.notification.request.content.data;
    const festivalId = data?.festivalId;
    const href = typeof data?.href === 'string' && data.href.startsWith('/') ? data.href : undefined;
    if (!id || handled.current === id || (typeof festivalId !== 'string' && !href)) return;
    handled.current = id;
    // Let navigation settle first when the app was opened by the tap.
    const t = setTimeout(() => router.push((href ?? `/festival/${festivalId}`) as never), 300);
    return () => clearTimeout(t);
  }, [response]);

  return null;
}
