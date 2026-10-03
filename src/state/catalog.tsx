import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
        .catch(() => {});
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
      }).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [source]);

  // Lineups and set times published from HQ, on top (LivePatchSync reads them).
  const patches = useLivePatches();
  const catalog = useMemo(() => {
    if (!patches.length) return base.catalog;
    const built = applyPatches(base, patches, parseCatalogFile);
    report(built.problems, 'published from HQ');
    return built.catalog;
  }, [base, patches]);

  // Clips you flagged as wrong are left out everywhere (ClipFlagsProvider sits outside this one).
  const { hidden } = useClipFlags();
  const shown = useMemo(() => withoutClips(catalog, hidden), [catalog, hidden]);
  return <CatalogContext.Provider value={shown}>{children}</CatalogContext.Provider>;
}

/** Artists, festivals and clips, with lookups. The only way screens should reach catalogue data. */
export function useCatalog() {
  return useContext(CatalogContext);
}
