import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { activityShow, type Glance } from '../features/glance/glance';

type NativeLive = {
  setGlance(json: string): void;
  lastGlance(): string | null;
  activitiesEnabled(): boolean;
  showActivity(festival: string, night: string, state: string, staleAt: number): Promise<boolean>;
  endActivities(): Promise<void>;
};

/**
 * Afterglow outside the app (`modules/afterglow-live`): the widgets, the
 * festival Live Activity and the Apple Watch. iPhone builds from 1.0.6 only;
 * everywhere else (Expo Go, Android, the website, older builds) these do nothing.
 */
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<NativeLive>('AfterglowLive') : null;

export const hasGlance = (): boolean => !!native;

/** Your festival at a glance, for the widgets and the Watch. Never throws. */
export function shareGlance(g: Glance) {
  try {
    native?.setGlance(JSON.stringify(g));
  } catch {
    // A widget that can't be told keeps what it had.
  }
}

/** Shows, updates or ends tonight's Live Activity to match the glance. Never throws. */
export async function syncLiveActivity(g: Glance, now: Date): Promise<void> {
  if (!native) return;
  try {
    const show = activityShow(g, now);
    if (!show) {
      await native.endActivities();
      return;
    }
    await native.showActivity(show.festival, show.night, JSON.stringify(show.state), Number.isFinite(show.staleAt) ? show.staleAt : 0);
  } catch {
    // Live Activities switched off in Settings, or the system said no: the app carries on.
  }
}

/** In the background (the festival trail's task): bring the Live Activity up to date from the last glance. */
export async function refreshLiveActivity(now: Date): Promise<void> {
  if (!native) return;
  try {
    const json = native.lastGlance();
    if (json) await syncLiveActivity(JSON.parse(json) as Glance, now);
  } catch {
    // Nothing to update.
  }
}
