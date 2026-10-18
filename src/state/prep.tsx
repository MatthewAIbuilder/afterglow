import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cleanCustom, cleanPrep, withCustomItem, type CustomItem } from '../features/prep/checklist';

/**
 * What you've ticked on each festival's Get ready list (ticket, travel, what
 * to pack) and the items you added yourself. Saved on the phone (AsyncStorage
 * `prep.v1` and `prepCustom.v1`); planning only, never fed to the taste engine.
 */
type Ctx = {
  tickedFor: (festivalId: string) => ReadonlySet<string>;
  toggle: (festivalId: string, item: string) => void;
  /** Your own items for a festival, oldest first. */
  customFor: (festivalId: string) => readonly CustomItem[];
  addCustom: (festivalId: string, text: string) => void;
  /** Takes your item off the list (and its tick). */
  removeCustom: (festivalId: string, id: string) => void;
  hydrated: boolean;
};

const KEY = 'prep.v1';
const CUSTOM_KEY = 'prepCustom.v1';
const NO_ITEMS: readonly CustomItem[] = [];
const EMPTY: ReadonlySet<string> = new Set();
const PrepContext = createContext<Ctx | null>(null);

export function PrepProvider({ children }: { children: ReactNode }) {
  const [ticked, setTicked] = useState<Record<string, string[]>>({});
  const [custom, setCustom] = useState<Record<string, CustomItem[]>>({});
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    const ticks = AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setTicked((cur) => ({ ...cleanPrep(JSON.parse(raw)), ...cur }));
      })
      .catch(() => {});
    const own = AsyncStorage.getItem(CUSTOM_KEY)
      .then((raw) => {
        if (raw) setCustom((cur) => ({ ...cleanCustom(JSON.parse(raw)), ...cur }));
      })
      .catch(() => {});
    void Promise.all([ticks, own]).finally(() => {
      loaded.current = true;
      setHydrated(true);
    });
  }, []);
  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(KEY, JSON.stringify(ticked)).catch(() => {});
  }, [ticked]);
  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(custom)).catch(() => {});
  }, [custom]);

  const sets = useMemo(() => Object.fromEntries(Object.entries(ticked).map(([k, v]) => [k, new Set(v)])), [ticked]);
  const tickedFor = useCallback((id: string) => sets[id] ?? EMPTY, [sets]);
  const toggle = useCallback((festivalId: string, item: string) => {
    setTicked((all) => {
      const list = all[festivalId] ?? [];
      return { ...all, [festivalId]: list.includes(item) ? list.filter((x) => x !== item) : [...list, item] };
    });
  }, []);

  const customFor = useCallback((id: string) => custom[id] ?? NO_ITEMS, [custom]);
  const addCustom = useCallback((festivalId: string, text: string) => {
    setCustom((all) => ({ ...all, [festivalId]: withCustomItem(all[festivalId] ?? [], text, () => `c${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`) }));
  }, []);
  const removeCustom = useCallback((festivalId: string, id: string) => {
    setCustom((all) => ({ ...all, [festivalId]: (all[festivalId] ?? []).filter((x) => x.id !== id) }));
    setTicked((all) => ({ ...all, [festivalId]: (all[festivalId] ?? []).filter((x) => x !== id) }));
  }, []);

  const value = useMemo<Ctx>(() => ({ tickedFor, toggle, customFor, addCustom, removeCustom, hydrated }), [tickedFor, toggle, customFor, addCustom, removeCustom, hydrated]);
  return <PrepContext.Provider value={value}>{children}</PrepContext.Provider>;
}

export function usePrepTicks(): Ctx {
  const ctx = useContext(PrepContext);
  if (!ctx) throw new Error('usePrepTicks must be used inside PrepProvider');
  return ctx;
}
