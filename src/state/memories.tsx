import { noteArtist } from '../data/extraArtists';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { deviceMemoryFiles, type MemoryFiles, type PickedVideo } from '../features/memories/device';
import type { Memory, MemoryTagInput } from '../features/memories/models';
import { addMemory, cleanMemories, forgetSharesBy, markShared, newMemoryId, orphanFiles, removeMemory, tagMemory } from '../features/memories/store';

/**
 * Your memories: the list (AsyncStorage `memories.v1`) and the video files
 * (Afterglow's own folder, by name). Also holds the one video from the
 * library waiting to be tagged (`draft`) between choosing it and saving it;
 * a fresh recording is kept at once, untagged (`keepNow`).
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
  /** Keep a video straight away, untagged (a fresh recording, so closing the app never loses it). */
  keepNow: (video: PickedVideo) => Promise<Memory | undefined>;
  tag: (id: string, tag: MemoryTagInput) => void;
  setShared: (id: string, shared: { id: string; by: string } | undefined) => void;
  /** An account was deleted: its shares no longer exist. */
  forgetShares: (uid: string) => void;
  /** Delete a memory and its files from this phone. */
  remove: (id: string) => Promise<void>;
  /** Whether a memory was deleted since the app opened (an upload finishing late checks this). */
  wasRemoved: (id: string) => boolean;
  uriOf: (name: string) => string;
  /** A memory (or its id) into Photos. A memory just kept can be passed whole, before the list has caught up. */
  saveToPhotos: (memory: string | Memory) => Promise<boolean>;
  /** The website: videos last only while the page is open (nothing is saved), so they're kept by sharing them. */
  sessionOnly: boolean;
};

export const MEMORIES_STORAGE_KEY = 'memories.v1';
/** A saved list that couldn't be read back whole, kept as it was (never written over, never tidied against). */
export const MEMORIES_DAMAGED_KEY = 'memoriesDamaged.v1';

const MemoriesContext = createContext<Ctx | null>(null);

export function MemoriesProvider({ children, files: given }: { children: ReactNode; files?: MemoryFiles }) {
  const files = given ?? deviceMemoryFiles;
  const [memories, setMemories] = useState<Memory[]>([]);
  // On the website nothing is saved or read back: there's nothing to wait for.
  const sessionOnly = !!files.sessionOnly;
  const [hydrated, setHydrated] = useState(sessionOnly);
  const [draft, setDraft] = useState<PickedVideo | undefined>();
  // The list is only ever written once it has been read back: a failed read (or a damaged file) must never be
  // replaced by the few memories made since, which would cost every older video on the next launch.
  const writable = useRef(false);
  // The memories as they are now, and whether one is being kept right now: the start-up tidy-up never takes their files.
  const current = useRef<Memory[]>([]);
  useEffect(() => {
    current.current = memories;
  }, [memories]);
  const keeping = useRef(false);

  // Read the saved list; after a failed read, try again a little later and whenever the app comes back.
  const [readTry, setReadTry] = useState(0);
  useEffect(() => {
    if (writable.current || sessionOnly) return;
    let live = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    Promise.all([AsyncStorage.getItem(MEMORIES_STORAGE_KEY), AsyncStorage.getItem(MEMORIES_DAMAGED_KEY)])
      .then(async ([raw, damaged]) => {
        if (!live) return;
        let parsed: unknown = [];
        try {
          parsed = raw ? JSON.parse(raw) : [];
        } catch {
          parsed = undefined;
        }
        const saved = cleanMemories(parsed);
        const whole = Array.isArray(parsed) && parsed.length === saved.length;
        // A damaged list is put aside untouched before anything is written over it, and from then on
        // nothing in the folder is ever tidied away (its videos are still there to be found).
        if (raw && !whole && !damaged) await AsyncStorage.setItem(MEMORIES_DAMAGED_KEY, raw);
        if (!live) return;
        setMemories((now) => [...now, ...saved.filter((m) => !now.some((c) => c.id === m.id))]);
        writable.current = true;
        setHydrated(true);
        // Files no memory points to (the app closed mid-save, or a delete was interrupted) are tidied away,
        // but only when the saved list read back whole, and only files more than a day old: a damaged list
        // or a video being kept right now must never cost you a video.
        if (whole && !damaged && !keeping.current) {
          void files.remove(orphanFiles(files.list(), [...saved, ...current.current], Date.now()));
        }
      })
      .catch(() => {
        if (!live) return;
        retry = setTimeout(() => setReadTry((t) => t + 1), Math.min(60_000, 2_000 * 2 ** Math.min(readTry, 5)));
      });
    return () => {
      live = false;
      if (retry) clearTimeout(retry);
    };
  }, [files, readTry, sessionOnly]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && !writable.current) setReadTry((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!writable.current || sessionOnly) return;
    AsyncStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify(memories)).catch(() => {});
  }, [memories, hydrated, sessionOnly]);
  // Artists you named who aren't on Afterglow yet: shown by that name everywhere (data/extraArtists.ts).
  useEffect(() => {
    for (const m of memories) if (m.artistName) noteArtist(m.artistId, m.artistName);
  }, [memories]);

  const keepVideo = useCallback(
    async (video: PickedVideo, tag: MemoryTagInput) => {
      if (keeping.current) return undefined;
      keeping.current = true;
      try {
        const now = Date.now();
        const id = newMemoryId(now);
        const ext = (video.uri.match(/\.([A-Za-z0-9]{2,4})(?:\?|$)/)?.[1] ?? 'mp4').toLowerCase();
        const file = `${id}.${ext}`;
        // A trimmed video's still comes from the part that plays.
        const { thumb } = await files.keep(video.uri, file, tag.clip ? { at: tag.clip.start } : undefined);
        const m: Memory = {
          id,
          file,
          thumb,
          capturedAt: (video.moment.when ?? new Date(now)).toISOString(),
          addedAt: new Date(now).toISOString(),
          durationSec: video.durationSec,
          width: video.width,
          height: video.height,
          place: video.moment.place,
          festivalId: tag.festivalId,
          night: tag.festivalId ? tag.night : undefined,
          past: tag.festivalId ? undefined : tag.past,
          show: tag.festivalId || tag.past ? undefined : tag.show,
          artistId: tag.artistId,
          withArtistIds: tag.artistId ? tag.withArtistIds : undefined,
          ...(tag.artistId && tag.artistName ? { artistName: tag.artistName } : {}),
          clip: tag.clip,
          people: tag.people?.length ? tag.people : undefined,
          ...(tag.track ? { track: tag.track } : {}),
        };
        setMemories((l) => addMemory(l, m));
        return m;
      } catch {
        return undefined;
      } finally {
        keeping.current = false;
      }
    },
    [files],
  );
  const keepDraft = useCallback(
    async (tag: MemoryTagInput) => {
      if (!draft) return undefined;
      const m = await keepVideo(draft, tag);
      if (m) setDraft(undefined);
      return m;
    },
    [draft, keepVideo],
  );
  const keepNow = useCallback((video: PickedVideo) => keepVideo(video, {}), [keepVideo]);

  const tag = useCallback((id: string, t: MemoryTagInput) => setMemories((l) => tagMemory(l, id, t)), []);
  const setShared = useCallback((id: string, shared: { id: string; by: string } | undefined) => setMemories((l) => markShared(l, id, shared)), []);
  const forgetShares = useCallback((uid: string) => setMemories((l) => forgetSharesBy(l, uid)), []);
  const memoriesRef = useRef(memories);
  useEffect(() => {
    memoriesRef.current = memories;
  }, [memories]);
  const removed = useRef(new Set<string>());
  const wasRemoved = useCallback((id: string) => removed.current.has(id), []);
  const remove = useCallback(
    async (id: string) => {
      removed.current.add(id);
      const m = memoriesRef.current.find((x) => x.id === id);
      setMemories((l) => removeMemory(l, id));
      if (m) await files.remove([m.file, m.thumb]);
    },
    [files],
  );
  const saveToPhotos = useCallback(
    async (memory: string | Memory) => {
      const m = typeof memory === 'string' ? memoriesRef.current.find((x) => x.id === memory) : memory;
      return m ? files.saveToPhotos(m.file) : false;
    },
    [files],
  );

  const value = useMemo<Ctx>(
    () => ({ memories, hydrated, draft, setDraft, keepDraft, keepNow, tag, setShared, forgetShares, remove, wasRemoved, uriOf: files.uriOf, saveToPhotos, sessionOnly }),
    [memories, hydrated, draft, keepDraft, keepNow, tag, setShared, forgetShares, remove, wasRemoved, files, saveToPhotos, sessionOnly],
  );
  return <MemoriesContext.Provider value={value}>{children}</MemoriesContext.Provider>;
}

export function useMemories() {
  const ctx = useContext(MemoriesContext);
  if (!ctx) throw new Error('useMemories must be used inside MemoriesProvider');
  return ctx;
}
