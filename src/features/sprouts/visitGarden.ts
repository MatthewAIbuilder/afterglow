import { t } from '../../i18n';
import type { ArtistLook } from './artistLook';
import type { Tier } from './artistSprouts';
import type { PublicResident } from './publicGarden';
import { kindOf, STAGE_NAMES } from './sprouts';
import type { SceneResident } from './GardenScene';

/** How big each stands in the garden: by stage for a sprout, by level for a collectible (as in your own). */
export const STAGE_SIZE = [64, 74, 84, 94] as const;
export const TIER_SIZE = [78, 83, 88, 94] as const;

/** Someone's published garden as residents of a meadow you're visiting. Pure apart from the look lookup. */
export function visitResidents(list: readonly PublicResident[], lookOf: (artistId: string, name: string) => ArtistLook): SceneResident[] {
  return list.map((r, i) =>
    r.k === 's'
      ? {
          id: `s${i}`,
          name: kindOf(r.kind).short,
          label: t('{name}, {growth}.', { name: r.kind === 'seedling' ? t('Sprout') : kindOf(r.kind).name, growth: STAGE_NAMES[r.stage] }),
          size: STAGE_SIZE[r.stage],
          look: { kind: r.kind, stage: r.stage },
        }
      : {
          id: `a${i}`,
          name: r.name,
          label: t('{artist} collectible.', { artist: r.name }),
          size: TIER_SIZE[r.tier as Tier],
          look: { artist: lookOf(r.artistId, r.name), tier: r.tier as Tier },
        },
  );
}
