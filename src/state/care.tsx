import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { addEntry, type Care, type WaterEvery, type CareEntry, cleanCare, EMPTY_CARE, type Mood, startTimer, stopTimer, tookMore as tookMoreOn, undoLast } from '../features/care/care';

/**
 * Look after yourself: timers, water and food, check-ins. Kept only in this
 * phone's storage (care.v1): never uploaded, never in recaps, profiles or
 * Your year. `clear` forgets all of it.
 */
type Ctx = {
  care: Care;
  hydrated: boolean;
  /** Start a stopwatch: your own words, or a timing guide entry (`guide`). */
  start: (label: string, guide?: string) => void;
  /** Log taking more on a stopwatch. */
  tookMore: (id: string) => void;
  stop: (id: string) => void;
  log: (kind: 'water' | 'food') => void;
  undo: (kind: CareEntry['kind']) => void;
  checkIn: (mood: Mood) => void;
  setLock: (on: boolean) => void;
  /** Water reminders during a festival night: every 45, 60 or 90 minutes, or off. */
  setWaterEvery: (every: WaterEvery | undefined) => void;
  clear: () => void;
};

const STORAGE_KEY = 'care.v1';

const CareContext = createContext<Ctx | undefined>(undefined);

export function CareProvider({ children }: { children: ReactNode }) {
  const [care, setCare] = useState<Care>(EMPTY_CARE);
  const [hydrated, setHydrated] = useState(false);
  const ready = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setCare((now) => (now === EMPTY_CARE ? cleanCare(JSON.parse(raw), Date.now()) : now));
      })
      .catch(() => {})
      .finally(() => {
        ready.current = true;
        setHydrated(true);
      });
  }, []);
  const update = useCallback((next: (c: Care) => Care) => {
    setCare((c) => {
      const out = next(c);
      if (out !== c && ready.current) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(out)).catch(() => {});
      return out;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      care,
      hydrated,
      start: (label, guide) => update((c) => startTimer(c, label, Date.now(), undefined, guide)),
      tookMore: (id) => update((c) => tookMoreOn(c, id, Date.now())),
      stop: (id) => update((c) => stopTimer(c, id)),
      log: (kind) => update((c) => addEntry(c, { kind, at: Date.now() })),
      undo: (kind) => update((c) => undoLast(c, kind)),
      checkIn: (mood) => update((c) => addEntry(c, { kind: 'checkin', mood, at: Date.now() })),
      setLock: (on) => update((c) => ({ ...c, lock: on })),
      setWaterEvery: (every) =>
        update((c) => {
          if (c.waterEvery === every) return c;
          const { waterEvery: _off, ...rest } = c;
          return every ? { ...rest, waterEvery: every } : rest;
        }),
      clear: () => {
        setCare(EMPTY_CARE);
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      },
    }),
    [care, hydrated, update],
  );
  return <CareContext.Provider value={value}>{children}</CareContext.Provider>;
}

export function useCare(): Ctx {
  const ctx = useContext(CareContext);
  if (!ctx) throw new Error('useCare needs a CareProvider');
  return ctx;
}
