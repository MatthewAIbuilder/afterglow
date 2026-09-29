import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MUSIC_RESYNC_MS } from '../config/music';
import { importedMusic, NO_IMPORTED_MUSIC, type ImportedMusic } from '../features/music/imported';
import { combineLibraries, librarySignals, type CombinedArtist } from '../features/music/library';
import { MUSIC_PROVIDERS, type MusicErrorKind, type MusicProviderId, type MusicState } from '../features/music/models';
import { errorKind, type ConnectResult, type MusicAvailability } from '../features/music/service';
import { defaultMusicServices, type MusicServices } from '../features/music/services';
import {
  cleanMusicState,
  connected,
  connectFailed,
  disconnected,
  syncFailed,
  syncStarted,
  syncSucceeded,
} from '../features/music/store';
import { useCatalog } from './catalog';

/**
 * Connected music services (Spotify, Apple Music): connecting, syncing and
 * disconnecting, and the imported layer they give the taste engine.
 *
 * Saved in AsyncStorage: each service's normalised snapshot and status only
 * (private, never shared). Tokens never pass through here: each service keeps
 * its own in the secure store. Disconnecting removes both.
 */
type Ctx = {
  state: MusicState;
  hydrated: boolean;
  availability: Record<MusicProviderId, MusicAvailability>;
  /** Sign in, then read the library. Resolves with what went wrong, if anything ('cancelled' included). */
  connect: (provider: MusicProviderId) => Promise<MusicErrorKind | 'cancelled' | undefined>;
  /** Read the library again. A failure keeps the last good import. */
  sync: (provider: MusicProviderId) => Promise<void>;
  /** Forget the sign-in and remove everything imported from that service. */
  disconnect: (provider: MusicProviderId) => Promise<void>;
  /** Every library, one record per artist. */
  library: CombinedArtist[];
  /** The library matched to the catalogue, for the taste engine. */
  imported: ImportedMusic;
  /** Services whose imported music is in use (they have a snapshot). */
  importing: MusicProviderId[];
  /** Services whose sign-in sheet is open right now. */
  connecting: MusicProviderId[];
};

export const MUSIC_STORAGE_KEY = 'musicLibrary.v1';

const MusicContext = createContext<Ctx | null>(null);

export function MusicConnectionsProvider({ children, services: given }: { children: ReactNode; services?: MusicServices }) {
  const services = useMemo(() => given ?? defaultMusicServices(), [given]);
  const [state, setState] = useState<MusicState>({});
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);
  // A sign-in or sync that finishes after a disconnect is dropped.
  const generation = useRef<Record<string, number>>({});

  useEffect(() => {
    AsyncStorage.getItem(MUSIC_STORAGE_KEY)
      .then((raw) => {
        const saved = raw ? cleanMusicState(JSON.parse(raw)) : {};
        setState((current) => ({ ...saved, ...current }));
        // A sign-in left in the secure store with no connection behind it (the iPhone keychain outlives an
        // uninstall, or the app closed mid-disconnect) is forgotten, so disconnecting always means gone.
        for (const p of MUSIC_PROVIDERS) {
          if (!saved[p] && !signingIn.current.has(p) && !inflight.current.has(p)) void services[p].disconnect().catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, [services]);

  useEffect(() => {
    if (!loaded.current) return;
    // Nothing connected: remove the key rather than keep an empty record around.
    const write = Object.keys(state).length
      ? AsyncStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(state))
      : AsyncStorage.removeItem(MUSIC_STORAGE_KEY);
    write.catch(() => {});
  }, [state]);

  // One read per service at a time: a second request (a double tap, the launch re-read) joins the one running.
  const inflight = useRef<Map<MusicProviderId, Promise<void>>>(new Map());
  const sync = useCallback(
    (provider: MusicProviderId): Promise<void> => {
      const running = inflight.current.get(provider);
      if (running) return running;
      const gen = generation.current[provider] ?? 0;
      const now = new Date();
      setState((s) => syncStarted(s, provider, now));
      const read = (async () => {
        try {
          const snapshot = await services[provider].fetchLibrary(now);
          if ((generation.current[provider] ?? 0) === gen) setState((s) => syncSucceeded(s, provider, snapshot));
        } catch (e) {
          if ((generation.current[provider] ?? 0) === gen) setState((s) => syncFailed(s, provider, errorKind(e)));
        }
        // Disconnected while reading: the read may have refreshed and re-saved the sign-in after
        // disconnect cleared it, so forget it again.
        if ((generation.current[provider] ?? 0) !== gen) await services[provider].disconnect().catch(() => {});
      })();
      const run = read.finally(() => {
        if (inflight.current.get(provider) === run) inflight.current.delete(provider);
      });
      inflight.current.set(provider, run);
      return run;
    },
    [services],
  );

  // One sign-in at a time per service (a second tap while the sheet is open does nothing).
  const signingIn = useRef<Set<MusicProviderId>>(new Set());
  const [connecting, setConnecting] = useState<MusicProviderId[]>([]);
  const connect = useCallback(
    async (provider: MusicProviderId) => {
      if (signingIn.current.has(provider)) return 'cancelled' as const;
      signingIn.current.add(provider);
      setConnecting((ps) => [...ps.filter((p) => p !== provider), provider]);
      const gen = generation.current[provider] ?? 0;
      let r: ConnectResult;
      try {
        r = await services[provider].connect();
      } catch {
        r = { ok: false, reason: 'unknown' };
      } finally {
        signingIn.current.delete(provider);
        setConnecting((ps) => ps.filter((p) => p !== provider));
      }
      if ((generation.current[provider] ?? 0) !== gen) {
        // Disconnected while the sign-in was open: forget whatever it stored.
        if (r.ok) await services[provider].disconnect().catch(() => {});
        return 'cancelled' as const;
      }
      if (!r.ok) {
        setState((s) => connectFailed(s, provider, r.reason === 'cancelled' ? undefined : r.reason));
        return r.reason;
      }
      setState((s) => connected(s, provider));
      await sync(provider);
      return undefined;
    },
    [services, sync],
  );

  const disconnect = useCallback(
    async (provider: MusicProviderId) => {
      // Any sign-in or read still running for it is dropped when it finishes.
      generation.current[provider] = (generation.current[provider] ?? 0) + 1;
      inflight.current.delete(provider);
      setState((s) => disconnected(s, provider));
      await services[provider].disconnect().catch(() => {});
    },
    [services],
  );

  // When the app opens: a connected library with no import yet, or older than a day, is read again.
  const resynced = useRef(false);
  useEffect(() => {
    if (!hydrated || resynced.current) return;
    resynced.current = true;
    const now = Date.now();
    for (const p of MUSIC_PROVIDERS) {
      const c = state[p];
      if (!c?.connected || !services[p].availability().ok) continue;
      const last = Date.parse(c.snapshot?.syncedAt ?? '');
      if (!c.snapshot || !(last > now - MUSIC_RESYNC_MS)) void sync(p);
    }
  }, [hydrated, state, services, sync]);

  const { artists } = useCatalog();
  const library = useMemo(() => combineLibraries(librarySignals(state)), [state]);
  const imported = useMemo(() => (library.length ? importedMusic(library, artists) : NO_IMPORTED_MUSIC), [library, artists]);
  const importing = useMemo(() => MUSIC_PROVIDERS.filter((p) => !!state[p]?.snapshot), [state]);
  const availability = useMemo(
    () => Object.fromEntries(MUSIC_PROVIDERS.map((p) => [p, services[p].availability()])) as Record<MusicProviderId, MusicAvailability>,
    [services],
  );

  const value = useMemo<Ctx>(
    () => ({ state, hydrated, availability, connect, sync, disconnect, library, imported, importing, connecting }),
    [state, hydrated, availability, connect, sync, disconnect, library, imported, importing, connecting],
  );
  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic must be used inside MusicConnectionsProvider');
  return ctx;
}
