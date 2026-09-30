import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Festivals you want reminders before each set for (a switch on Your
 * festival). Saved on the phone (AsyncStorage `setReminders.v1`); planning
 * only, never fed to the taste engine. `changed` counts switches you flip,
 * so the reminder sync knows it may ask for permission.
 */
type Ctx = { on: ReadonlySet<string>; setOn: (festivalId: string, on: boolean) => void; hydrated: boolean; changed: number };

const KEY = 'setReminders.v1';
const SetRemindersContext = createContext<Ctx | null>(null);

export function SetRemindersProvider({ children }: { children: ReactNode }) {
  const [on, setIds] = useState<ReadonlySet<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [changed, setChanged] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const list = raw ? (JSON.parse(raw) as unknown) : [];
        if (Array.isArray(list)) setIds((cur) => new Set([...list.filter((x): x is string => typeof x === 'string'), ...cur]));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);
  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(KEY, JSON.stringify([...on])).catch(() => {});
  }, [on]);

  const setOn = useCallback((id: string, want: boolean) => {
    setIds((cur) => {
      if (cur.has(id) === want) return cur;
      const next = new Set(cur);
      if (want) next.add(id);
      else next.delete(id);
      return next;
    });
    setChanged((n) => n + 1);
  }, []);

  const value = useMemo(() => ({ on, setOn, hydrated, changed }), [on, setOn, hydrated, changed]);
  return <SetRemindersContext.Provider value={value}>{children}</SetRemindersContext.Provider>;
}

export function useSetReminders() {
  const ctx = useContext(SetRemindersContext);
  if (!ctx) throw new Error('useSetReminders must be used inside SetRemindersProvider');
  return ctx;
}
