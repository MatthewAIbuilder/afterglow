import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cleanRead, notices, type Notice } from '../features/notifications/inbox';
import { useToday } from '../lib/useToday';
import { useCatalog } from './catalog';
import { useGoing } from './going';
import { useWeekends } from './weekends';

/** The bell's notices, worked out from your festivals, and which ones you've read (saved on the device). */
type Ctx = {
  list: Notice[];
  read: ReadonlySet<string>;
  markRead: (ids: string[]) => void;
  /** Read notices have loaded, so the bell never flashes a count it shouldn't. */
  hydrated: boolean;
};

const STORAGE_KEY = 'noticesRead.v1';

const NoticesContext = createContext<Ctx | null>(null);

export function NoticesProvider({ children }: { children: ReactNode }) {
  const { festivals } = useCatalog();
  const { going } = useGoing();
  const today = useToday();
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setRead((current) => new Set([...cleanRead(JSON.parse(raw)), ...current]));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...read])).catch(() => {});
  }, [read]);

  const markRead = useCallback((ids: string[]) => {
    setRead((current) => (ids.every((id) => current.has(id)) ? current : new Set([...current, ...ids])));
  }, []);

  // Festivals as they are for you: a two-weekend festival follows the weekend you're going to.
  const { forYou } = useWeekends();
  const mine = useMemo(() => festivals.map(forYou), [festivals, forYou]);
  const list = useMemo(() => notices(mine, going, today), [mine, going, today]);
  const value = useMemo<Ctx>(() => ({ list, read, markRead, hydrated }), [list, read, markRead, hydrated]);
  return <NoticesContext.Provider value={value}>{children}</NoticesContext.Provider>;
}

export function useNotices() {
  const ctx = useContext(NoticesContext);
  if (!ctx) throw new Error('useNotices must be used inside NoticesProvider');
  return ctx;
}
