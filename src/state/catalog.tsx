import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CATALOG_TIMEOUT_MS, CATALOG_URL } from '../config/data';
import { BUILT_IN } from '../data/bundled';
import { type Catalog, createCatalog, withoutClips } from '../data/catalog';
import type { CatalogSource } from '../data/models';
import { type FetchText, refreshCatalog, type TextStore } from '../data/remote';
import { validateSnapshot } from '../data/validate';
import { useClipFlags } from './clipFlags';

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
  const [catalog, setCatalog] = useState(builtInCatalog);

  useEffect(() => {
    report(BUILT_IN.problems, 'catalogue/afterglow.json');
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (source) {
      source
        .load()
        .then((snapshot) => {
          if (!cancelled) setCatalog(createCatalog(validateSnapshot(snapshot).snapshot));
        })
        .catch(() => {});
    } else if (CATALOG_URL) {
      refreshCatalog({
        url: CATALOG_URL,
        base: BUILT_IN.snapshot,
        fetchText,
        store: storeFor(CATALOG_URL.trim()),
        onCatalog: (built) => {
          if (!cancelled) setCatalog(built.catalog);
        },
        onProblems: (problems, from) => report(problems, from === 'online' ? CATALOG_URL : 'saved copy'),
      }).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [source]);

  // Pull to refresh: read the hosted catalogue again (new festivals and clips arrive each night).
  const refresh = useCallback(async () => {
    const started = Date.now();
    if (!source && CATALOG_URL)
      await refreshCatalog({
        url: CATALOG_URL,
        base: BUILT_IN.snapshot,
        fetchText,
        store: storeFor(CATALOG_URL.trim()),
        onCatalog: (built) => setCatalog(built.catalog),
        onProblems: (problems, from) => report(problems, from === 'online' ? CATALOG_URL : 'saved copy'),
      }).catch(() => {});
    // Long enough for the spinner to read as "checked".
    const left = 700 - (Date.now() - started);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
  }, [source]);

  // Clips you flagged as wrong are left out everywhere (ClipFlagsProvider sits outside this one).
  const { hidden } = useClipFlags();
  const shown = useMemo(() => withoutClips(catalog, hidden), [catalog, hidden]);
  return (
    <CatalogRefreshContext.Provider value={refresh}>
      <CatalogContext.Provider value={shown}>{children}</CatalogContext.Provider>
    </CatalogRefreshContext.Provider>
  );
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
