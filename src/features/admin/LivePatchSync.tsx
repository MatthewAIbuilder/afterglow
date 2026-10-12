import { useEffect } from 'react';
import { AppState } from 'react-native';
import { setAppSettings } from '../../state/appSettings';
import { setLivePatches } from '../../state/livePatches';
import { useSocial } from '../../state/social';

let refreshNow: (() => void) | undefined;
/** Read published updates again now (HQ calls it after publishing or taking one down). */
export const refreshLivePatches = () => refreshNow?.();

/**
 * Reads the catalogue updates published from HQ when the app opens and each
 * time it comes back to the front, so a published lineup or set times shows
 * within minutes for everyone, signed in or not. A failed read keeps what
 * the phone had. The app-wide switches set from HQ (`AppSettings`, such as
 * the care timing guide) are read at the same moments. Renders nothing.
 */
export function LivePatchSync() {
  const { service, availability } = useSocial();
  useEffect(() => {
    if (!availability.ok) return;
    let busy = false;
    const read = () => {
      if (busy) return;
      busy = true;
      service.appSettings().then(setAppSettings, () => {});
      service
        .livePatches()
        .then(setLivePatches)
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
    };
    refreshNow = read;
    read();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && read());
    return () => {
      sub.remove();
      if (refreshNow === read) refreshNow = undefined;
    };
  }, [service, availability.ok]);
  return null;
}
