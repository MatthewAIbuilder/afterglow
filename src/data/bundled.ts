import raw from '../../catalogue/afterglow.json';
import { parseCatalogFile } from './file';
import { buildCatalog } from './merge';
import type { CatalogSnapshot } from './models';
import { MOCK_SNAPSHOT } from './mock';

/**
 * The two invented festivals in the demo data (Solstice 2026, Horizon 2027).
 * The app never shows them (the user chose to hide them before launch on
 * 2026-10-05): only real festivals reach people and App Review. The demo
 * artists and clips stay. Tests keep them, since the golden and screen tests
 * are built on them.
 */
export const DEMO_FESTIVALS: ReadonlySet<string> = new Set(['solstice-26', 'horizon-27']);

/** The demo data as the app ships it: everything but the invented festivals, unless asked for (tests). */
export function shippedDemo(withDemoFestivals: boolean): CatalogSnapshot {
  return withDemoFestivals ? MOCK_SNAPSHOT : { ...MOCK_SNAPSHOT, festivals: MOCK_SNAPSHOT.festivals.filter((f) => !DEMO_FESTIVALS.has(f.id)) };
}

const underTest = typeof process !== 'undefined' && !!process.env?.JEST_WORKER_ID;

/**
 * What the app ships with: the demo data (without its invented festivals)
 * plus catalogue/afterglow.json. This is the first frame's catalogue, and
 * what a hosted file (CATALOG_URL) is added to.
 */
export const BUNDLED_FILE = parseCatalogFile(raw);
export const BUILT_IN = buildCatalog(shippedDemo(underTest), BUNDLED_FILE, { needClips: underTest });
