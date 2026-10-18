import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { t } from '../../i18n';
import { color } from '../../theme/tokens';
import type { Fix } from './trail';
import { readActive, recordFixes, writeActive } from './trailStore';

/**
 * The phone side of the festival trail: a background location task that adds where you are to the trail
 * while the app is closed, only between `start` and `stop` (a festival day you said yes to). The task
 * stops itself once it's past the festival's end, so it can never run on an ordinary day. Phones only
 * (the website has no background location: `trailRecorder.web.ts`); needs the app's own build (not Expo Go).
 * This file is imported by the root layout so the task is defined every time the app starts, even when the
 * system wakes it for a location.
 */
export const TRAIL_TASK = 'afterglow-festival-trail';

if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TRAIL_TASK, async ({ data, error }) => {
    if (error) return;
    const fixes: Fix[] = (data?.locations ?? []).map((l) => ({ at: l.timestamp, lat: l.coords.latitude, lon: l.coords.longitude, accuracy: l.coords.accuracy }));
    if ((await recordFixes(fixes, Date.now())) === 'stop') await stopRecording();
  });
}

/** Whether this phone lets Afterglow record where you are while it's closed. */
export type TrailPermission = 'always' | 'while-open' | 'denied' | 'undetermined';

export async function trailPermission(): Promise<TrailPermission> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted) return fg.canAskAgain === false ? 'denied' : 'undetermined';
    const bg = await Location.getBackgroundPermissionsAsync();
    return bg.granted ? 'always' : bg.canAskAgain === false ? 'while-open' : 'undetermined';
  } catch {
    return 'denied';
  }
}

/** Ask for the location permissions the trail needs (the phone's own prompts; "Always" comes second, as iOS asks). */
export async function askTrailPermission(): Promise<TrailPermission> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return 'denied';
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.granted ? 'always' : 'while-open';
  } catch {
    return 'denied';
  }
}

/** Start recording for a festival until `until` (ms). Needs "Always" (or "While using", which records while the app is open). */
export async function startRecording(festivalId: string, until: number): Promise<boolean> {
  try {
    await writeActive({ festivalId, until });
    if (await Location.hasStartedLocationUpdatesAsync(TRAIL_TASK)) return true;
    await Location.startLocationUpdatesAsync(TRAIL_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 15,
      timeInterval: 60_000,
      deferredUpdatesInterval: 60_000,
      deferredUpdatesDistance: 30,
      pausesUpdatesAutomatically: true,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: t('Afterglow is keeping your festival trail'),
        notificationBody: t('Only today, only on this phone.'),
        notificationColor: color.glow,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Stop recording (any day that isn't a festival day, or when you turn it off). */
export async function stopRecording(): Promise<void> {
  try {
    await writeActive(undefined);
    if (await Location.hasStartedLocationUpdatesAsync(TRAIL_TASK)) await Location.stopLocationUpdatesAsync(TRAIL_TASK);
  } catch {
    // Nothing was recording.
  }
}

/** Is it recording right now? */
export async function isRecording(): Promise<boolean> {
  try {
    return !!(await readActive()) && (await Location.hasStartedLocationUpdatesAsync(TRAIL_TASK));
  } catch {
    return false;
  }
}
