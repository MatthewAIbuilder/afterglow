import { createCatalog } from '../catalog';
import type { CatalogSnapshot, CatalogSource } from '../models';
import { validateSnapshot } from '../validate';
import { ARTISTS } from './artists';
import { CLIPS } from './clips';
import { FESTIVALS } from './festivals';

/**
 * The prototype's catalogue: fictional festivals, real artists and verified
 * official clips. The only place mock records are assembled; the app reads
 * them through the catalogue like any other source.
 */
export const MOCK_SNAPSHOT: CatalogSnapshot = { artists: ARTISTS, festivals: FESTIVALS, clips: CLIPS };

/** The mock catalogue, checked and indexed exactly as any other source would be. */
export const MOCK_CATALOG = createCatalog(validateSnapshot(MOCK_SNAPSHOT).snapshot);

export const mockSource: CatalogSource = { name: 'mock', load: async () => MOCK_SNAPSHOT };

export { MOCK_TASTE } from './tasteProfile';
