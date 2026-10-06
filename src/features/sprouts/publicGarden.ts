import type { ArtistSprout, Tier } from './artistSprouts';
import { isKind, type GardenView, type SproutKind, type Stage } from './sprouts';

/**
 * A garden as others see it, pure: who lives there (each sprout's kind and
 * how grown it is, each artist collectible and its level), and nothing else
 * (no notes, no sprout codes, no dates). The owner publishes it
 * (`gardens/{uid}`), anyone signed in can visit it from their profile.
 */
export type PublicResident = { k: 's'; kind: SproutKind; stage: Stage } | { k: 'a'; artistId: string; name: string; tier: Tier };

/** At most this many live in a published garden. */
export const PUBLIC_GARDEN_MAX = 120;
const NAME_MAX = 60;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/;

const isStage = (v: unknown): v is Stage => v === 0 || v === 1 || v === 2 || v === 3;
const isTier = (v: unknown): v is Tier => v === 0 || v === 1 || v === 2 || v === 3;

/** The garden as it's shown: sprouts newest first, then collectibles earned, then ones given. */
export function publicGarden(garden: readonly GardenView[], artists: readonly ArtistSprout[], nameOf: (artistId: string) => string | undefined): PublicResident[] {
  const out: PublicResident[] = [];
  for (const g of garden) if (!g.artist) out.push({ k: 's', kind: g.shown, stage: g.stage });
  for (const a of artists) {
    const name = nameOf(a.artistId);
    if (name) out.push({ k: 'a', artistId: a.artistId, name: name.slice(0, NAME_MAX), tier: a.tier });
  }
  for (const g of garden) if (g.artist && ID.test(g.artist.id)) out.push({ k: 'a', artistId: g.artist.id, name: (nameOf(g.artist.id) ?? g.artist.name).slice(0, NAME_MAX), tier: 0 });
  return out.slice(0, PUBLIC_GARDEN_MAX);
}

/** A published garden read back: anything that doesn't look right is left out. */
export function cleanPublicGarden(raw: unknown): PublicResident[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicResident[] = [];
  for (const r of raw.slice(0, PUBLIC_GARDEN_MAX)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (o.k === 's' && isKind(o.kind) && isStage(o.stage)) out.push({ k: 's', kind: o.kind, stage: o.stage });
    else if (o.k === 'a' && typeof o.artistId === 'string' && ID.test(o.artistId) && typeof o.name === 'string' && o.name.trim() && isTier(o.tier))
      out.push({ k: 'a', artistId: o.artistId, name: o.name.trim().slice(0, NAME_MAX), tier: o.tier });
  }
  return out;
}

/** Whether two published gardens are the same (so nothing is written when nothing changed). */
export const gardenKey = (list: readonly PublicResident[]) => list.map((r) => (r.k === 's' ? `s${r.kind}${r.stage}` : `a${r.artistId}${r.tier}`)).join('|');

/** "12 sprouts · 3 collectibles"-style counts. */
export function gardenCounts(list: readonly PublicResident[]) {
  const sprouts = list.filter((r) => r.k === 's').length;
  return { sprouts, collectibles: list.length - sprouts };
}
