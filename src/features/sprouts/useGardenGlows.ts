import { useEffect, useMemo, useState } from 'react';
import { type GardenGlow, lastGlows as last } from '../../state/gardenGlows';
import { useSocial } from '../../state/social';

export type { GardenGlow };

/**
 * Glows visitors left on your garden, newest first: read when you look (and
 * kept from the last read meanwhile). Empty when signed out or offline.
 */
export function useGardenGlows(): GardenGlow[] {
  const social = useSocial();
  const uid = social.user?.uid;
  const { service } = social;
  const [, bump] = useState(0);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    service
      .gardenGlows()
      .then((list) => {
        last.set(uid, list);
        if (live) bump((n) => n + 1);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [uid, service]);
  // Someone you blocked doesn't show, or count.
  const { blocked } = social;
  const list = (uid && last.get(uid)) || NONE;
  return useMemo(() => (blocked.size ? list.filter((g) => !blocked.has(g.from)) : list), [list, blocked]);
}

const NONE: GardenGlow[] = [];
