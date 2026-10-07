import type { ArtistSprout, Tier } from './artistSprouts';
import { isKind, type GardenView, type SproutKind, type Stage } from './sprouts';

/**
 * A garden as others see it, pure: who lives there (each sprout's kind and
 * how grown it is, each artist collectible and its level), and nothing else
 * (no notes, no sprout codes, no dates). The owner publishes it
 * (`gardens/{uid}`), anyone signed in can visit it from their profile.
 */
export type PublicResident = { k: 's'; kind: SproutKind; stage: Stage } | { k: 'a'; artistId: string; name: string; tier: Tier; shiny?: true; pin?: Pin };
/** A collectible's place in its owner's showcase (showcase.ts). */
export type Pin = 1 | 2 | 3;
const isPin = (v: unknown): v is Pin => v === 1 || v === 2 || v === 3;

/** At most this many live in a published garden. */
export const PUBLIC_GARDEN_MAX = 120;
const NAME_MAX = 60;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/;

const isStage = (v: unknown): v is Stage => v === 0 || v === 1 || v === 2 || v === 3;
const isTier = (v: unknown): v is Tier => v === 0 || v === 1 || v === 2 || v === 3;

/**
 * The garden as it's shown: sprouts newest first, then collectibles earned,
 * then ones given. Collectibles in your showcase (`pinned`, artist ids in
 * order) are marked with their place and always kept, however full it is.
 */
export function publicGarden(garden: readonly GardenView[], artists: readonly ArtistSprout[], nameOf: (artistId: string) => string | undefined, pinned: readonly string[] = []): PublicResident[] {
  const out: PublicResident[] = [];
  for (const g of garden) if (!g.artist) out.push({ k: 's', kind: g.shown, stage: g.stage });
  for (const a of artists) {
    const name = nameOf(a.artistId);
    const at = pinned.indexOf(a.artistId) + 1;
    if (name) out.push({ k: 'a', artistId: a.artistId, name: name.slice(0, NAME_MAX), tier: a.tier, ...(a.shiny ? { shiny: true as const } : {}), ...(isPin(at) ? { pin: at } : {}) });
  }
  for (const g of garden) if (g.artist && ID.test(g.artist.id)) out.push({ k: 'a', artistId: g.artist.id, name: (nameOf(g.artist.id) ?? g.artist.name).slice(0, NAME_MAX), tier: 0 });
  const isPinned = (r: PublicResident) => r.k === 'a' && !!r.pin;
  const pins = out.filter(isPinned);
  return [...out.filter((r) => !isPinned(r)).slice(0, PUBLIC_GARDEN_MAX - pins.length), ...pins];
}

/** The showcase in a published garden: its pinned collectibles, in order. */
export const showcaseOf = (list: readonly PublicResident[]) =>
  list.filter((r): r is Extract<PublicResident, { k: 'a' }> => r.k === 'a' && !!r.pin).sort((a, b) => (a.pin ?? 0) - (b.pin ?? 0));

/** A published garden read back: anything that doesn't look right is left out. */
export function cleanPublicGarden(raw: unknown): PublicResident[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicResident[] = [];
  for (const r of raw.slice(0, PUBLIC_GARDEN_MAX)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (o.k === 's' && isKind(o.kind) && isStage(o.stage)) out.push({ k: 's', kind: o.kind, stage: o.stage });
    else if (o.k === 'a' && typeof o.artistId === 'string' && ID.test(o.artistId) && typeof o.name === 'string' && o.name.trim() && isTier(o.tier))
      out.push({ k: 'a', artistId: o.artistId, name: o.name.trim().slice(0, NAME_MAX), tier: o.tier, ...(o.shiny === true ? { shiny: true as const } : {}), ...(isPin(o.pin) ? { pin: o.pin } : {}) });
  }
  return out;
}

/** Whether two published gardens are the same (so nothing is written when nothing changed). */
export const gardenKey = (list: readonly PublicResident[]) => list.map((r) => (r.k === 's' ? `s${r.kind}${r.stage}` : `a${r.artistId}${r.tier}${r.shiny ? '*' : ''}${r.pin ?? ''}`)).join('|');

/** "12 sprouts · 3 collectibles"-style counts. */
export function gardenCounts(list: readonly PublicResident[]) {
  const sprouts = list.filter((r) => r.k === 's').length;
  return { sprouts, collectibles: list.length - sprouts };
}
