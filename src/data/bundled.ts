import raw from '../../catalogue/afterglow.json';
import { parseCatalogFile } from './file';
import { buildCatalog } from './merge';
import { MOCK_SNAPSHOT } from './mock';

/**
 * What the app ships with: the demo data plus catalogue/afterglow.json. This
 * is the first frame's catalogue, and what a hosted file (CATALOG_URL) is
 * added to.
 */
export const BUNDLED_FILE = parseCatalogFile(raw);
export const BUILT_IN = buildCatalog(MOCK_SNAPSHOT, BUNDLED_FILE);
