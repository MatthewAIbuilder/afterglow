import { useEffect, useState } from 'react';
import type { VenueMap } from '../features/venueMap/venueMap';
import { useSocial } from './social';
import * as store from './venueMapsStore';
import { keep, listeners, load } from './venueMapsStore';

/**
 * Festival maps, read from Afterglow and kept on this phone (`venueMaps.v1`)
 * so the map still opens with no signal at the festival. Read again when the
 * page opens and the copy is more than an hour old.
 */
const FRESH_MS = 3600_000;

/** A festival's map (kept, then fresh), or null when it has none. Undefined while it's first being read. */
export function useVenueMap(festivalId: string | undefined): VenueMap | null | undefined {
  const social = useSocial();
  const service = social.service;
  const [, bump] = useState(0);
  useEffect(() => {
    if (!festivalId) return;
    let live = true;
    const l = () => live && bump((n) => n + 1);
    listeners.add(l);
    void load().then(async (c) => {
      l();
      const have = c[festivalId];
      if (have && Date.now() - have.at < FRESH_MS) return;
      try {
        keep(festivalId, await service.venueMap(festivalId));
      } catch {
        // No signal: the phone's copy stands.
      }
    });
    return () => {
      live = false;
      listeners.delete(l);
    };
  }, [festivalId, service]);
  return festivalId ? store.cache?.[festivalId]?.map : undefined;
}

/** After HQ saves a map, the phone shows it straight away. */
export const rememberVenueMap = (map: VenueMap) => keep(map.festivalId, map);
