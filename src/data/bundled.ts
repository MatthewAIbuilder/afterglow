import raw from '../../catalogue/afterglow.json';
import { parseCatalogFile } from './file';
import { buildCatalog } from './merge';
import type { CatalogSnapshot, Festival } from './models';
import { MOCK_SNAPSHOT } from './mock';

/**
 * The two invented festivals in the demo data (Solstice 2026, Horizon 2027).
 * The app never shows them (the user chose to hide them before launch on
 * 2026-10-05): only real festivals reach people and App Review. The demo
 * artists stay, and their clips move to real festivals (below). Tests keep
 * the festivals, since the golden and screen tests are built on them.
 */
export const DEMO_FESTIVALS: ReadonlySet<string> = new Set(['solstice-26', 'horizon-27']);

/**
 * The demo data as the app ships it: everything but the invented festivals,
 * unless asked for (tests). The demo clips are real, checked official videos
 * of real artists; filed under the invented festivals they'd be left out with
 * them, so each moves to the first real festival (in `real`, catalogue order)
 * whose lineup has its artist. A clip whose artist plays no real festival is
 * left out.
 */
export function shippedDemo(withDemoFestivals: boolean, real: readonly Festival[] = []): CatalogSnapshot {
  if (withDemoFestivals) return MOCK_SNAPSHOT;
  const clips = MOCK_SNAPSHOT.clips.flatMap((c) => {
    if (!DEMO_FESTIVALS.has(c.festivalId)) return [c];
    const home = real.find((f) => !DEMO_FESTIVALS.has(f.id) && f.lineup.includes(c.artistId));
    return home ? [{ ...c, festivalId: home.id }] : [];
  });
  return { ...MOCK_SNAPSHOT, festivals: MOCK_SNAPSHOT.festivals.filter((f) => !DEMO_FESTIVALS.has(f.id)), clips };
}

const underTest = typeof process !== 'undefined' && !!process.env?.JEST_WORKER_ID;

/**
 * What the app ships with: the demo data (without its invented festivals)
 * plus catalogue/afterglow.json. This is the first frame's catalogue, and
 * what a hosted file (CATALOG_URL) is added to.
 */
export const BUNDLED_FILE = parseCatalogFile(raw);
export const BUILT_IN = buildCatalog(shippedDemo(underTest, BUNDLED_FILE.snapshot?.festivals), BUNDLED_FILE, { needClips: underTest });
