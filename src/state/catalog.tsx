import AsyncStorage from '@react-native-async-storage/async-storage';
import { extraArtist, extraArtistsVersion, subscribeExtraArtists } from '../data/extraArtists';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode, useSyncExternalStore } from 'react';
import { CATALOG_TIMEOUT_MS, CATALOG_URL } from '../config/data';
import { BUILT_IN } from '../data/bundled';
import { type Catalog, createCatalog, withoutClips } from '../data/catalog';
import type { CatalogSource } from '../data/models';
import { parseCatalogFile } from '../data/file';
import { applyPatches, type Built } from '../data/merge';
import { type FetchText, refreshCatalog, type TextStore } from '../data/remote';
import { validateSnapshot } from '../data/validate';
import { useClipFlags } from './clipFlags';
import { useLivePatches } from './livePatches';
import { useOrgs } from './orgs';
import { withOrgs } from '../features/organizers/organizers';
import { withGuessedSounds } from '../data/soundGuess';

/**
 * The catalogue the app is showing. Starts with what ships with the app (the
 * demo data plus catalogue/afterglow.json), so every screen has everything on
 * its first frame. With CATALOG_URL set, it then switches to the last saved
 * copy of the hosted file and to a fresh one once it has arrived and been
 * checked; until then, or if that fails, what it has stays. A `source` can be
 * passed instead, for tests or other sources.
 */
export const builtInCatalog = BUILT_IN.catalog;

const CatalogContext = createContext<Catalog>(builtInCatalog);

const STORE_KEY = 'catalogFile.v1';

/** The last good hosted file, remembered together with its link so a new link never shows an old file. */
function storeFor(url: string): TextStore {
  return {
    get: async () => {
      const raw = await AsyncStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw) as { url?: string; text?: string };
      return saved.url === url && typeof saved.text === 'string' ? saved.text : null;
    },
    set: (text) => AsyncStorage.setItem(STORE_KEY, JSON.stringify({ url, text })),
  };
}

const fetchText: FetchText = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
};

/** Mistakes in a catalogue file show in the Expo terminal while developing, never to people using the app. */
function report(problems: string[], from: string) {
  if (__DEV__ && problems.length) console.warn(`Catalogue (${from}):\n- ${problems.join('\n- ')}`);
}

export function CatalogProvider({ source, children }: { source?: CatalogSource; children: ReactNode }) {
  const [base, setBase] = useState<Built>(BUILT_IN);
  // Whether the hosted file has been tried (arrived, or failed): until then a link to something only it has isn't missing yet.
  const [settled, setSettled] = useState(!source && !CATALOG_URL);

  useEffect(() => {
    report(BUILT_IN.problems, 'catalogue/afterglow.json');
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (source) {
      source
        .load()
        .then((snapshot) => {
          if (cancelled) return;
          const checked = validateSnapshot(snapshot).snapshot;
          setBase({ catalog: createCatalog(checked), snapshot: checked, problems: [], usedFile: true });
        })
        .catch(() => {})
        .finally(() => !cancelled && setSettled(true));
    } else if (CATALOG_URL) {
      refreshCatalog({
        url: CATALOG_URL,
        base: BUILT_IN.snapshot,
        fetchText,
        store: storeFor(CATALOG_URL.trim()),
        onCatalog: (built) => {
          if (!cancelled) setBase(built);
        },
        onProblems: (problems, from) => report(problems, from === 'online' ? CATALOG_URL : 'saved copy'),
      })
        .catch(() => {})
        .finally(() => !cancelled && setSettled(true));
    }
    return () => {
      cancelled = true;
    };
  }, [source]);

  // Lineups and set times published from HQ, on top (LivePatchSync reads them).
  const patches = useLivePatches();
  const patched = useMemo(() => {
    if (!patches.length) return base;
    const built = applyPatches(base, patches, parseCatalogFile);
    report(built.problems, 'published from HQ');
    return built;
  }, [base, patches]);
  // Events organizers published themselves (features/organizers), on top: never over a festival already there.
  const orgs = useOrgs();
  const catalog = useMemo(() => {
    const merged = withOrgs(patched.snapshot, orgs);
    if (merged === patched.snapshot) return patched.catalog;
    const checked = validateSnapshot(merged);
    report(checked.problems, 'organizers');
    return createCatalog(withGuessedSounds(checked.snapshot));
  }, [patched, orgs]);

  // Pull to refresh: read the hosted catalogue again (new festivals and clips arrive each night).
  const refresh = useCallback(async () => {
    const started = Date.now();
    if (!source && CATALOG_URL)
      await refreshCatalog({
        url: CATALOG_URL,
        base: BUILT_IN.snapshot,
        fetchText,
        store: storeFor(CATALOG_URL.trim()),
        onCatalog: (built) => setBase(built),
        onProblems: (problems, from) => report(problems, from === 'online' ? CATALOG_URL : 'saved copy'),
      }).catch(() => {});
    // Long enough for the spinner to read as "checked".
    const left = 700 - (Date.now() - started);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
  }, [source]);

  // Clips you flagged as wrong are left out everywhere (ClipFlagsProvider sits outside this one).
  const { hidden } = useClipFlags();
  // Artists people named on their videos who aren't on Afterglow yet (data/extraArtists.ts): found by id too.
  const extras = useSyncExternalStore(subscribeExtraArtists, extraArtistsVersion, extraArtistsVersion);
  const shown = useMemo(() => {
    const c = withoutClips(catalog, hidden);
    return extras ? { ...c, artist: (id: string) => c.artist(id) ?? extraArtist(id) } : c;
  }, [catalog, hidden, extras]);
  return (
    <CatalogRefreshContext.Provider value={refresh}>
      <CatalogSettledContext.Provider value={settled}>
        <CatalogContext.Provider value={shown}>{children}</CatalogContext.Provider>
      </CatalogSettledContext.Provider>
    </CatalogRefreshContext.Provider>
  );
}

const CatalogSettledContext = createContext(true);

/** False while the hosted catalogue is still on its way (a link opened fresh may need it). */
export function useCatalogSettled() {
  return useContext(CatalogSettledContext);
}

const CatalogRefreshContext = createContext<() => Promise<void>>(async () => {});

/** Reads the hosted catalogue again (pull to refresh). */
export function useCatalogRefresh() {
  return useContext(CatalogRefreshContext);
}

/** Artists, festivals and clips, with lookups. The only way screens should reach catalogue data. */
export function useCatalog() {
  return useContext(CatalogContext);
}
