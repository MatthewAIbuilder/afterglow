import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import type { Festival } from '../data/models';
import { isOver } from '../features/festivals/shelves';
import { distanceKm, isPoint, lookupText, roughly, unitsFor, type Point, type Units } from '../features/festivals/near';
import { useCatalog } from './catalog';

/**
 * Festivals near you: where you are (only after you ask for it, rounded to
 * about a kilometre, kept on this phone or in this browser) and where each
 * festival is. Imported festivals carry their venue's coordinates; on phones
 * the rest are looked up once from their location text and remembered.
 */
export type NearStatus = 'off' | 'locating' | 'on' | 'denied' | 'failed';

type Area = Point & { label?: string; at: number };

type Ctx = {
  status: NearStatus;
  /** Where you are, roughly, once turned on. */
  here?: Point;
  /** The town you're in, when the phone could tell ("Orlando"). */
  hereLabel?: string;
  units: Units;
  /** Ask for your location (the system asks the first time). */
  turnOn: () => Promise<NearStatus>;
  /** Forget where you are. */
  turnOff: () => void;
  placeOf: (f: Festival) => Point | undefined;
  /** How far a festival is from you, in km, when both are known. */
  distanceTo: (f: Festival) => number | undefined;
  hydrated: boolean;
};

const AREA_KEY = 'nearYou.v1';
const PLACES_KEY = 'festivalPlaces.v1';
/** Where you are is refreshed when older than this (only if you already allowed it). */
export const AREA_FRESH_MS = 24 * 60 * 60 * 1000;
/** Place lookups per session (the phone's geocoder has a rate limit). */
const LOOKUPS_PER_SESSION = 25;

const NearbyContext = createContext<Ctx | null>(null);

const localeNow = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
};

async function locate(): Promise<Area | undefined> {
  const pos =
    (await Location.getLastKnownPositionAsync({ maxAge: 60 * 60_000 }).catch(() => null)) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  const p = roughly({ lat: pos.coords.latitude, lon: pos.coords.longitude });
  if (!isPoint(p)) return undefined;
  let label: string | undefined;
  if (Platform.OS !== 'web') {
    try {
      const [addr] = await Location.reverseGeocodeAsync({ latitude: p.lat, longitude: p.lon });
      label = addr?.city ?? addr?.subregion ?? addr?.region ?? undefined;
    } catch {}
  }
  return { ...p, ...(label ? { label } : {}), at: Date.now() };
}

export function NearbyProvider({ children }: { children: ReactNode }) {
  const { festivals } = useCatalog();
  const [area, setArea] = useState<Area>();
  const [status, setStatus] = useState<NearStatus>('off');
  const [places, setPlaces] = useState<Record<string, Point | null>>({});
  const [hydrated, setHydrated] = useState(false);
  const lookups = useRef(0);
  const tried = useRef(new Set<string>());
  const units = useMemo(() => unitsFor(localeNow()), []);

  // What was saved: your area (refreshed quietly when stale and already allowed) and looked-up places.
  useEffect(() => {
    let live = true;
    Promise.all([AsyncStorage.getItem(AREA_KEY).catch(() => null), AsyncStorage.getItem(PLACES_KEY).catch(() => null)])
      .then(async ([rawArea, rawPlaces]) => {
        let saved: Area | undefined;
        try {
          const a = rawArea ? JSON.parse(rawArea) : undefined;
          if (isPoint(a) && typeof (a as Area).at === 'number') saved = a as Area;
        } catch {}
        try {
          const ps = rawPlaces ? JSON.parse(rawPlaces) : {};
          if (ps && typeof ps === 'object' && live)
            setPlaces(Object.fromEntries(Object.entries(ps).filter(([, v]) => isPoint(v))) as Record<string, Point>);
        } catch {}
        if (!live || !saved) return;
        setArea(saved);
        setStatus('on');
        if (Date.now() - saved.at < AREA_FRESH_MS) return;
        try {
          const perm = await Location.getForegroundPermissionsAsync();
          if (!perm.granted) return;
          const fresh = await locate();
          if (fresh && live) setArea(fresh);
        } catch {}
      })
      .finally(() => live && setHydrated(true));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (area) AsyncStorage.setItem(AREA_KEY, JSON.stringify(area)).catch(() => {});
    else AsyncStorage.removeItem(AREA_KEY).catch(() => {});
  }, [area, hydrated]);

  const turnOn = useCallback(async (): Promise<NearStatus> => {
    setStatus('locating');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setStatus('denied');
        return 'denied';
      }
      const found = await locate();
      if (!found) {
        setStatus('failed');
        return 'failed';
      }
      setArea(found);
      setStatus('on');
      return 'on';
    } catch {
      setStatus('failed');
      return 'failed';
    }
  }, []);

  const turnOff = useCallback(() => {
    setArea(undefined);
    setStatus('off');
  }, []);

  // Once you're on, look up festivals without coordinates (phones only; the website has no geocoder).
  useEffect(() => {
    if (!area || Platform.OS === 'web') return;
    const today = new Date();
    const wanted = [
      ...new Set(
        festivals
          .filter((f) => !f.place && !isOver(f, today))
          .map(lookupText)
          .filter((t): t is string => !!t && !(t in places) && !tried.current.has(t)),
      ),
    ];
    if (!wanted.length) return;
    let live = true;
    (async () => {
      for (const text of wanted) {
        if (!live || lookups.current >= LOOKUPS_PER_SESSION) break;
        tried.current.add(text);
        lookups.current++;
        try {
          const [hit] = await Location.geocodeAsync(text);
          const p = hit ? { lat: Math.round(hit.latitude * 1000) / 1000, lon: Math.round(hit.longitude * 1000) / 1000 } : undefined;
          if (live && isPoint(p))
            setPlaces((all) => {
              const next = { ...all, [text]: p };
              AsyncStorage.setItem(PLACES_KEY, JSON.stringify(next)).catch(() => {});
              return next;
            });
        } catch {
          // Not found or rate limited: tried again next time the app opens.
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [area, festivals, places]);

  const placeOf = useCallback(
    (f: Festival) => {
      if (f.place) return f.place;
      const t = lookupText(f);
      return (t && places[t]) || undefined;
    },
    [places],
  );
  const here = useMemo(() => (area ? { lat: area.lat, lon: area.lon } : undefined), [area]);
  const distanceTo = useCallback(
    (f: Festival) => {
      if (!here) return undefined;
      const p = placeOf(f);
      return p ? distanceKm(here, p) : undefined;
    },
    [here, placeOf],
  );

  const value = useMemo<Ctx>(
    () => ({ status, here, hereLabel: area?.label, units, turnOn, turnOff, placeOf, distanceTo, hydrated }),
    [status, here, area?.label, units, turnOn, turnOff, placeOf, distanceTo, hydrated],
  );
  return <NearbyContext.Provider value={value}>{children}</NearbyContext.Provider>;
}

const OFF: Ctx = {
  status: 'off',
  units: 'km',
  turnOn: async () => 'off',
  turnOff: () => {},
  placeOf: (f) => f.place,
  distanceTo: () => undefined,
  hydrated: true,
};

/** Where you are and how far festivals are. Outside the provider (some tests), nothing is near. */
export function useNearby(): Ctx {
  return useContext(NearbyContext) ?? OFF;
}
