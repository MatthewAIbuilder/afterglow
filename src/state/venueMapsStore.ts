import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanVenueMap, type VenueMap } from '../features/venueMap/venueMap';

/** Festival maps kept on this phone (`venueMaps.v1`), shared by every screen (state/venueMaps.ts). */
export const VENUE_MAPS_KEY = 'venueMaps.v1';

type Kept = { map: VenueMap | null; at: number };
export let cache: Record<string, Kept> | undefined;
let loading: Promise<Record<string, Kept>> | undefined;
export const listeners = new Set<() => void>();

export function load(): Promise<Record<string, Kept>> {
  if (cache) return Promise.resolve(cache);
  loading ??= AsyncStorage.getItem(VENUE_MAPS_KEY)
    .then((raw) => {
      const o = raw ? (JSON.parse(raw) as Record<string, { map?: unknown; at?: unknown }>) : {};
      const out: Record<string, Kept> = {};
      for (const [id, k] of Object.entries(o)) {
        const map = k.map ? (cleanVenueMap(id, k.map) ?? null) : null;
        if (typeof k.at === 'number') out[id] = { map, at: k.at };
      }
      return out;
    })
    .catch(() => ({}))
    .then((c) => {
      cache ??= c;
      loading = undefined;
      return cache;
    });
  return loading;
}

export function keep(id: string, map: VenueMap | null) {
  cache = { ...(cache ?? {}), [id]: { map, at: Date.now() } };
  listeners.forEach((l) => l());
  void AsyncStorage.setItem(VENUE_MAPS_KEY, JSON.stringify(cache)).catch(() => {});
}

export function forgetVenueMaps() {
  cache = undefined;
  loading = undefined;
}

