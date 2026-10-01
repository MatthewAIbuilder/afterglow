import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cleanClipMemory, EMPTY_CLIP_MEMORY, trackClips, type ClipMemory } from '../features/notifications/clipNews';
import { useToday } from '../lib/useToday';
import { useCatalog } from './catalog';

/**
 * Which clips have arrived lately. Every clip id the catalogue has shown is
 * remembered on the phone (clipNews.v1), so new sets (the nightly YouTube
 * clips) become bell news for the artists you'd love. Catalogue facts only;
 * nothing about you is stored here.
 */
type Ctx = { memory: ClipMemory; hydrated: boolean };

const STORAGE_KEY = 'clipNews.v1';

const ClipNewsContext = createContext<Ctx>({ memory: EMPTY_CLIP_MEMORY, hydrated: false });

export function ClipNewsProvider({ children }: { children: ReactNode }) {
  const { clips } = useCatalog();
  const [memory, setMemory] = useState<ClipMemory | undefined>();
  const [stored, setStored] = useState<ClipMemory | undefined>();
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => (raw ? cleanClipMemory(JSON.parse(raw)) : EMPTY_CLIP_MEMORY))
      .catch(() => EMPTY_CLIP_MEMORY)
      .then((m) => {
        setStored(m);
        setMemory(m);
      });
  }, []);

  // Each catalogue the app shows is compared with the clips seen before.
  const now = useToday().getTime();
  const tracked = useMemo(() => (memory ? trackClips(memory, clips, now) : undefined), [memory, clips, now]);
  useEffect(() => {
    if (!tracked || tracked === stored) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tracked)).catch(() => {});
  }, [tracked, stored]);
  if (tracked && memory && tracked !== memory) setMemory(tracked);

  const value = useMemo<Ctx>(() => ({ memory: tracked ?? EMPTY_CLIP_MEMORY, hydrated: !!tracked }), [tracked]);
  return <ClipNewsContext.Provider value={value}>{children}</ClipNewsContext.Provider>;
}

export function useClipNews() {
  return useContext(ClipNewsContext);
}
