import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Festival } from '../data/models';
import { cleanMode, festivalMode, leave as leaveMode, type ModeNow, type ModeSaved, NO_MODE, withChoice, withPreview } from '../features/festivalMode/mode';
import { useTonight } from '../features/tonight/useTonight';
import { useNow } from '../lib/useNow';
import { useCatalog } from './catalog';
import { useWeekends } from './weekends';

/**
 * Festival mode: a simpler app while you're at a festival (Discover with
 * videos filmed there, tonight's plan, the camera in the middle, friends).
 * Your answers are kept on this phone (AsyncStorage `festivalMode.v1`).
 */
type Ctx = {
  /** On right now, for this festival. */
  active?: ModeNow;
  /** A festival you're going to is on and you haven't said yet. */
  ask?: Festival;
  turnOn: (festivalId: string) => void;
  /** Not now: the full app stays for this festival. */
  notNow: (festivalId: string) => void;
  /** Back to the full app. */
  leave: () => void;
  /** Try it now, before the festival. */
  preview: (festivalId: string) => void;
  hydrated: boolean;
};

export const FESTIVAL_MODE_KEY = 'festivalMode.v1';

const OFF: Ctx = { turnOn: () => {}, notNow: () => {}, leave: () => {}, preview: () => {}, hydrated: true };
const ModeContext = createContext<Ctx | null>(null);

export function FestivalModeProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<ModeSaved>(NO_MODE);
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);
  const tonight = useTonight();
  const catalog = useCatalog();
  const { forYou } = useWeekends();

  useEffect(() => {
    AsyncStorage.getItem(FESTIVAL_MODE_KEY)
      .then((raw) => {
        if (raw) setSaved(cleanMode(JSON.parse(raw), Date.now()));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);
  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(FESTIVAL_MODE_KEY, JSON.stringify(saved)).catch(() => {});
  }, [saved]);

  // Checked every minute, so a preview also ends on time.
  const minute = Math.floor(useNow().getTime() / 60_000) * 60_000;
  const festivals = useMemo(() => catalog.festivals.map(forYou), [catalog.festivals, forYou]);
  const mode = useMemo(() => (hydrated ? festivalMode(saved, tonight, festivals, minute) : {}), [hydrated, saved, tonight, festivals, minute]);
  const active = mode.active;

  const turnOn = useCallback((id: string) => setSaved((s) => withChoice(s, id, 'on')), []);
  const notNow = useCallback((id: string) => setSaved((s) => withChoice(s, id, 'off')), []);
  const preview = useCallback((id: string) => setSaved((s) => withPreview(s, id, Date.now())), []);
  const leave = useCallback(() => setSaved((s) => leaveMode(s, active)), [active]);

  const value = useMemo<Ctx>(
    () => ({ active, ask: mode.ask, turnOn, notNow, leave, preview, hydrated }),
    [active, mode.ask, turnOn, notNow, leave, preview, hydrated],
  );
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

/** Festival mode, or off outside the provider. */
export function useFestivalMode(): Ctx {
  return useContext(ModeContext) ?? OFF;
}
