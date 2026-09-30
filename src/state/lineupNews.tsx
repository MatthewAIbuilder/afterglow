import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cleanLineupMemory, EMPTY_LINEUP_MEMORY, justAdded, trackLineups, type LineupMemory } from '../features/notifications/lineupNews';
import { useToday } from '../lib/useToday';
import { useCatalog } from './catalog';

/**
 * What's been added to lineups lately. Every act seen on each festival's
 * lineup is remembered on the phone (lineupNews.v1), so when a catalogue
 * update adds someone, it's news: the bell mentions the ones you'd love and
 * the festival page marks them "Just added". Catalogue facts only; nothing
 * about you is stored here.
 */
type Ctx = {
  memory: LineupMemory;
  /** Acts added to this festival lately. */
  justAdded: (festivalId: string) => ReadonlySet<string>;
  hydrated: boolean;
};

const STORAGE_KEY = 'lineupNews.v1';
const NONE: ReadonlySet<string> = new Set();

const LineupNewsContext = createContext<Ctx>({ memory: EMPTY_LINEUP_MEMORY, justAdded: () => NONE, hydrated: false });

export function LineupNewsProvider({ children }: { children: ReactNode }) {
  const { festivals } = useCatalog();
  const [memory, setMemory] = useState<LineupMemory | undefined>();

  // What was read back from storage, so only real changes are written.
  const [stored, setStored] = useState<LineupMemory | undefined>();
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => (raw ? cleanLineupMemory(JSON.parse(raw)) : EMPTY_LINEUP_MEMORY))
      .catch(() => EMPTY_LINEUP_MEMORY)
      .then((m) => {
        setStored(m);
        setMemory(m);
      });
  }, []);

  // Each catalogue the app shows (built in, then a saved or fresh hosted one) is compared with what was seen before.
  const today = useToday();
  const now = today.getTime();
  const tracked = useMemo(() => (memory ? trackLineups(memory, festivals, now) : undefined), [memory, festivals, now]);
  useEffect(() => {
    if (!tracked || tracked === stored) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tracked)).catch(() => {});
  }, [tracked, stored]);
  // Keep the newer memory as the base, so the next catalogue is compared with it.
  if (tracked && memory && tracked !== memory) setMemory(tracked);

  const value = useMemo<Ctx>(() => {
    const m = tracked ?? EMPTY_LINEUP_MEMORY;
    return { memory: m, justAdded: (id) => justAdded(m, id, now), hydrated: !!tracked };
  }, [tracked, now]);
  return <LineupNewsContext.Provider value={value}>{children}</LineupNewsContext.Provider>;
}

export function useLineupNews() {
  return useContext(LineupNewsContext);
}
