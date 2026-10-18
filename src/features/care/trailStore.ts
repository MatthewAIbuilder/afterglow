import AsyncStorage from '@react-native-async-storage/async-storage';
import { addFixes, cleanPrefs, cleanTrails, type Fix, type TrailPrefs, type Trails } from './trail';

/**
 * Where the festival trail is kept on the phone (AsyncStorage, per account): the trails themselves, your
 * choice, and which festival is being recorded and until when. Shared by the app and the background task
 * that records while the app is closed (`trailRecorder.ts`). Never leaves the phone.
 */
export const TRAIL_KEY = 'trail.v1';
export const TRAIL_PREFS_KEY = 'trailPrefs.v1';
export const TRAIL_ACTIVE_KEY = 'trailActive.v1';

export type TrailActive = { festivalId: string; until: number };

export async function readTrails(): Promise<Trails> {
  try {
    const raw = await AsyncStorage.getItem(TRAIL_KEY);
    return raw ? cleanTrails(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export async function readPrefs(): Promise<TrailPrefs> {
  try {
    const raw = await AsyncStorage.getItem(TRAIL_PREFS_KEY);
    return cleanPrefs(raw ? JSON.parse(raw) : undefined);
  } catch {
    return cleanPrefs(undefined);
  }
}

export async function writePrefs(prefs: TrailPrefs): Promise<void> {
  await AsyncStorage.setItem(TRAIL_PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
  for (const l of listeners) l();
}

export async function readActive(): Promise<TrailActive | undefined> {
  try {
    const raw = await AsyncStorage.getItem(TRAIL_ACTIVE_KEY);
    const o = raw ? (JSON.parse(raw) as Partial<TrailActive>) : undefined;
    return o && typeof o.festivalId === 'string' && typeof o.until === 'number' ? { festivalId: o.festivalId, until: o.until } : undefined;
  } catch {
    return undefined;
  }
}

export async function writeActive(active: TrailActive | undefined): Promise<void> {
  await (active ? AsyncStorage.setItem(TRAIL_ACTIVE_KEY, JSON.stringify(active)) : AsyncStorage.removeItem(TRAIL_ACTIVE_KEY)).catch(() => {});
}

/** Delete every trail on this phone. */
export async function clearTrails(): Promise<void> {
  await AsyncStorage.removeItem(TRAIL_KEY).catch(() => {});
  for (const l of listeners) l();
}

/**
 * What the background task does with what the phone reports: add the good positions to the festival being
 * recorded, or say it's time to stop (nothing is being recorded, or it's past the end). One at a time, so two
 * reports arriving together never lose each other's.
 */
let queue: Promise<unknown> = Promise.resolve();
export function recordFixes(fixes: readonly Fix[], now: number): Promise<'recorded' | 'stop'> {
  const run = async (): Promise<'recorded' | 'stop'> => {
    const active = await readActive();
    if (!active || now > active.until) return 'stop';
    const trails = await readTrails();
    const next = addFixes(trails[active.festivalId] ?? [], fixes);
    if (next.length !== (trails[active.festivalId]?.length ?? 0)) {
      await AsyncStorage.setItem(TRAIL_KEY, JSON.stringify({ ...trails, [active.festivalId]: next })).catch(() => {});
      for (const l of listeners) l();
    }
    return 'recorded';
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

const listeners = new Set<() => void>();
/** Told whenever the trail or your choice changes (so the screen shows it). */
export function onTrailChange(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
