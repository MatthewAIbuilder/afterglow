import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { cleanPrefs, type TrailPrefs, type Trails } from './trail';
import { isRecording, trailPermission, type TrailPermission } from './trailRecorder';
import { onTrailChange, readPrefs, readTrails } from './trailStore';

export type TrailState = {
  loaded: boolean;
  trails: Trails;
  prefs: TrailPrefs;
  permission: TrailPermission;
  recording: boolean;
};

const EMPTY: TrailState = { loaded: false, trails: {}, prefs: cleanPrefs(undefined), permission: 'undetermined', recording: false };

/** How often the screen reads the trail again while it's open (the background task adds to it). */
const REFRESH_MS = 20_000;

async function load(): Promise<TrailState> {
  const [trails, prefs, permission, recording] = await Promise.all([readTrails(), readPrefs(), Platform.OS === 'web' ? Promise.resolve('denied' as const) : trailPermission(), isRecording()]);
  return { loaded: true, trails, prefs, permission, recording };
}

/** The festival trail on this phone, your choice, whether it's recording, and what the phone allows. Kept fresh while open. */
export function useTrail(): TrailState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<TrailState>(EMPTY);
  const refresh = useCallback(async () => setState(await load()), []);
  useEffect(() => {
    let live = true;
    const read = () => void load().then((next) => live && setState(next));
    read();
    const stop = onTrailChange(read);
    const timer = setInterval(read, REFRESH_MS);
    return () => {
      live = false;
      stop();
      clearInterval(timer);
    };
  }, []);
  return { ...state, refresh };
}
