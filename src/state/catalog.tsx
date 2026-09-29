import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type Catalog, createCatalog } from '../data/catalog';
import { MOCK_CATALOG } from '../data/mock';
import type { CatalogSource } from '../data/models';
import { validateSnapshot } from '../data/validate';

/**
 * The catalogue the app is showing. Starts with the built-in mock data, so
 * every screen has everything on its first frame. Given a `source`, it loads
 * that too and switches over once it has arrived and been checked; until
 * then, or if it fails, the built-in data stays.
 */
export const builtInCatalog = MOCK_CATALOG;

const CatalogContext = createContext<Catalog>(builtInCatalog);

export function CatalogProvider({ source, children }: { source?: CatalogSource; children: ReactNode }) {
  const [catalog, setCatalog] = useState(builtInCatalog);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    source
      .load()
      .then((snapshot) => {
        if (cancelled) return;
        const { snapshot: clean } = validateSnapshot(snapshot);
        setCatalog(createCatalog(clean));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [source]);

  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}

/** Artists, festivals and clips, with lookups. The only way screens should reach catalogue data. */
export function useCatalog() {
  return useContext(CatalogContext);
}
