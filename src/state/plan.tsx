import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isMustSee, mustSeesAt, toggleMustSee, type MustSees } from '../features/plan/mustSees';
import * as E from '../features/plan/edits';

/**
 * Artists you have starred as a must-see, per festival. A planning preference
 * only: it puts them first in that festival's plan and wins clashes there, but
 * it is kept apart from reactions so it never teaches the taste engine anything.
 */
type Ctx = {
  mustSeesAt: (festivalId: string) => ReadonlySet<string>;
  isMustSee: (festivalId: string, artistId: string) => boolean;
  toggleMustSee: (festivalId: string, artistId: string) => void;
  /** Every star at every festival, as "festival:artist" (daily quests count them). */
  starKeys: string[];
  /** Saved stars have loaded (or failed to). */
  hydrated: boolean;
  /** Your own changes to a festival's plan (`features/plan/edits.ts`). */
  editsAt: (festivalId: string) => E.EditsAt;
  /** "Not this one": out of your plan here, and unstarred. */
  takeOut: (festivalId: string, artistId: string) => void;
  bringBack: (festivalId: string, artistId: string) => void;
  bringAllBack: (festivalId: string) => void;
  /** "Go with this one": starred, and your first choice over the sets it clashes with. */
  goWith: (festivalId: string, artistId: string, over?: readonly string[]) => void;
  /** Only what you starred, nothing suggested. */
  setOwn: (festivalId: string, own: boolean) => void;
};

// v1 stored stars per artist for every festival. Those can't be assigned to a festival, so they are dropped.
const STORAGE_KEY = 'mustSees.v2';
const OLD_KEY = 'mustSees.v1';
const EDITS_KEY = 'planEdits.v1';

const PlanContext = createContext<Ctx | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [all, setAll] = useState<MustSees>({});
  const loaded = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [edits, setEdits] = useState<E.PlanEdits>({});
  const editsLoaded = useRef(false);

  useEffect(() => {
    AsyncStorage.removeItem(OLD_KEY).catch(() => {});
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setAll((current) => ({ ...JSON.parse(raw), ...current }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
    AsyncStorage.getItem(EDITS_KEY)
      .then((raw) => {
        if (raw) setEdits((current) => ({ ...E.cleanEdits(JSON.parse(raw)), ...current }));
      })
      .catch(() => {})
      .finally(() => {
        editsLoaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all)).catch(() => {});
  }, [all]);

  useEffect(() => {
    if (!editsLoaded.current) return;
    AsyncStorage.setItem(EDITS_KEY, JSON.stringify(edits)).catch(() => {});
  }, [edits]);

  const toggle = useCallback((festivalId: string, artistId: string) => {
    setAll((current) => toggleMustSee(current, festivalId, artistId));
  }, []);

  const edit = useMemo(
    () => ({
      takeOut: (f: string, a: string) => {
        setEdits((c) => E.takeOut(c, f, a));
        setAll((c) => (isMustSee(c, f, a) ? toggleMustSee(c, f, a) : c));
      },
      bringBack: (f: string, a: string) => setEdits((c) => E.bringBack(c, f, a)),
      bringAllBack: (f: string) => setEdits((c) => E.bringAllBack(c, f)),
      goWith: (f: string, a: string, over?: readonly string[]) => {
        setEdits((c) => E.goWith(c, f, a, over));
        setAll((c) => (isMustSee(c, f, a) ? c : toggleMustSee(c, f, a)));
      },
      setOwn: (f: string, own: boolean) => setEdits((c) => E.setOwn(c, f, own)),
    }),
    [],
  );

  const value = useMemo<Ctx>(
    () => ({
      mustSeesAt: (festivalId) => mustSeesAt(all, festivalId),
      isMustSee: (festivalId, artistId) => isMustSee(all, festivalId, artistId),
      toggleMustSee: toggle,
      starKeys: Object.entries(all).flatMap(([f, ids]) => (Array.isArray(ids) ? ids.map((a) => `${f}:${a}`) : [])),
      hydrated,
      editsAt: (festivalId) => E.editsAt(edits, festivalId),
      ...edit,
    }),
    [all, toggle, hydrated, edits, edit],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used inside PlanProvider');
  return ctx;
}
