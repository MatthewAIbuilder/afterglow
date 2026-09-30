import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { deviceMemoryFiles, type MemoryFiles, type PickedVideo } from '../features/memories/device';
import type { Memory, MemoryTagInput } from '../features/memories/models';
import { addMemory, cleanMemories, forgetSharesBy, markShared, newMemoryId, removeMemory, tagMemory } from '../features/memories/store';

/**
 * Your memories: the list (AsyncStorage `memories.v1`) and the video files
 * (Afterglow's own folder, by name). Also holds the one video waiting to be
 * tagged (`draft`) between choosing it and saving it.
 *
 * Private: nothing here leaves the phone. Sharing to your profile is a
 * separate, explicit step (state/social.tsx).
 */
type Ctx = {
  memories: Memory[];
  hydrated: boolean;
  /** The video you just recorded or chose, waiting in the tagging sheet. */
  draft?: PickedVideo;
  setDraft: (v: PickedVideo | undefined) => void;
  /** Keep the draft as a memory with this tag. Resolves with the new memory, or undefined if the file couldn't be kept. */
  keepDraft: (tag: MemoryTagInput) => Promise<Memory | undefined>;
  tag: (id: string, tag: MemoryTagInput) => void;
  setShared: (id: string, shared: { id: string; by: string } | undefined) => void;
  /** An account was deleted: its shares no longer exist. */
  forgetShares: (uid: string) => void;
  /** Delete a memory and its files from this phone. */
  remove: (id: string) => Promise<void>;
  uriOf: (name: string) => string;
  saveToPhotos: (id: string) => Promise<boolean>;
};

export const MEMORIES_STORAGE_KEY = 'memories.v1';

const MemoriesContext = createContext<Ctx | null>(null);

export function MemoriesProvider({ children, files: given }: { children: ReactNode; files?: MemoryFiles }) {
  const files = given ?? deviceMemoryFiles;
  const [memories, setMemories] = useState<Memory[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState<PickedVideo | undefined>();
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(MEMORIES_STORAGE_KEY)
      .then((raw) => {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        const saved = cleanMemories(parsed);
        setMemories((current) => [...current, ...saved.filter((m) => !current.some((c) => c.id === m.id))]);
        // Files no memory points to (the app closed mid-save, or a delete was interrupted) are tidied away,
        // but only when the saved list read back whole: a damaged list must never cost you a video.
        if (Array.isArray(parsed) && parsed.length === saved.length) {
          const used = new Set(saved.flatMap((m) => [m.file, m.thumb]));
          void files.remove(files.list().filter((n) => !used.has(n)));
        }
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, [files]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify(memories)).catch(() => {});
  }, [memories]);

  const keeping = useRef(false);
  const keepDraft = useCallback(
    async (tag: MemoryTagInput) => {
      if (!draft || keeping.current) return undefined;
      keeping.current = true;
      try {
        const now = Date.now();
        const id = newMemoryId(now);
        const ext = (draft.uri.match(/\.([A-Za-z0-9]{2,4})(?:\?|$)/)?.[1] ?? 'mp4').toLowerCase();
        const file = `${id}.${ext}`;
        const { thumb } = await files.keep(draft.uri, file);
        const m: Memory = {
          id,
          file,
          thumb,
          capturedAt: (draft.moment.when ?? new Date(now)).toISOString(),
          addedAt: new Date(now).toISOString(),
          durationSec: draft.durationSec,
          width: draft.width,
          height: draft.height,
          place: draft.moment.place,
          festivalId: tag.festivalId,
          night: tag.festivalId ? tag.night : undefined,
          artistId: tag.artistId,
        };
        setMemories((l) => addMemory(l, m));
        setDraft(undefined);
        return m;
      } catch {
        return undefined;
      } finally {
        keeping.current = false;
      }
    },
    [draft, files],
  );

  const tag = useCallback((id: string, t: MemoryTagInput) => setMemories((l) => tagMemory(l, id, t)), []);
  const setShared = useCallback((id: string, shared: { id: string; by: string } | undefined) => setMemories((l) => markShared(l, id, shared)), []);
  const forgetShares = useCallback((uid: string) => setMemories((l) => forgetSharesBy(l, uid)), []);
  const memoriesRef = useRef(memories);
  useEffect(() => {
    memoriesRef.current = memories;
  }, [memories]);
  const remove = useCallback(
    async (id: string) => {
      const m = memoriesRef.current.find((x) => x.id === id);
      setMemories((l) => removeMemory(l, id));
      if (m) await files.remove([m.file, m.thumb]);
    },
    [files],
  );
  const saveToPhotos = useCallback(
    async (id: string) => {
      const m = memoriesRef.current.find((x) => x.id === id);
      return m ? files.saveToPhotos(m.file) : false;
    },
    [files],
  );

  const value = useMemo<Ctx>(
    () => ({ memories, hydrated, draft, setDraft, keepDraft, tag, setShared, forgetShares, remove, uriOf: files.uriOf, saveToPhotos }),
    [memories, hydrated, draft, keepDraft, tag, setShared, forgetShares, remove, files, saveToPhotos],
  );
  return <MemoriesContext.Provider value={value}>{children}</MemoriesContext.Provider>;
}

export function useMemories() {
  const ctx = useContext(MemoriesContext);
  if (!ctx) throw new Error('useMemories must be used inside MemoriesProvider');
  return ctx;
}
