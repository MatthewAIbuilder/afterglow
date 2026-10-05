import { useEffect } from 'react';
import { AppState } from 'react-native';
import { notifyNow } from '../../lib/notifyNow';
import { useCatalog } from '../../state/catalog';
import { loadScouted, setScouted } from '../../state/scouted';
import { useSocial } from '../../state/social';

/**
 * Checks, when the app opens and comes back to the front, whether set times
 * you sent have gone live, and thanks you once for each (a notification, if
 * they're allowed; Set scout on your profile either way). Signed in only.
 * Renders nothing.
 */
export function ScoutSync() {
  const { service, availability, user } = useSocial();
  const { festival } = useCatalog();
  const uid = user?.uid;
  useEffect(() => {
    if (!availability.ok || !uid) return;
    let busy = false;
    const read = () => {
      if (busy) return;
      busy = true;
      Promise.all([service.mySetTimes(), loadScouted()])
        .then(([tips]) => {
          const fresh = setScouted(
            uid,
            tips.filter((t) => t.status === 'live').map((t) => t.festivalId),
          );
          for (const id of fresh) {
            const name = festival(id)?.name ?? 'the festival';
            void notifyNow(`scout:${id}`, 'Your set times are live', `Thank you! Everyone sees the ${name} set times you sent now.`, `/festival/${id}`);
          }
        })
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
    };
    read();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && read());
    return () => sub.remove();
  }, [service, availability.ok, uid, festival]);
  return null;
}
