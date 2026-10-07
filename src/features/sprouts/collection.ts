import { t } from '../../i18n';
import { CHARMS, type CharmId, PATTERNS, type PatternId } from '../kandi/kandi';
import { type ArtistLook, type Creature, PLACE_CREATURES, SIGNATURE_NAMES, SOUND_CREATURES, foldName } from './artistLook';
import type { ArtistSprout } from './artistSprouts';
import { DECOR, type DecorId } from './decor';
import { SPROUT_KINDS, type SproutKind } from './sprouts';

/**
 * Your collection, pure: every set there is to collect, what you have of
 * each and what's still out there. Sprout kinds (grown or given), the
 * hand-made artist collectibles (for artists on Afterglow), the sound
 * creatures any other artist's collectible can be, stickers found in the
 * wild, and kandi beads and charms you've been given. Shiny ones are
 * counted on their own (they're luck, not a set).
 */
export type SetId = 'kinds' | 'signatures' | 'sounds' | 'stickers' | 'beads' | 'charms' | 'decor';
export type CollectionItem = { key: string; have: boolean };
export type CollectionSet = { id: SetId; title: string; how: string; items: CollectionItem[]; have: number; total: number };

export type CollectionInput = {
  /** Sprout kinds in your garden (grown or given). */
  kinds: ReadonlySet<SproutKind>;
  /** Your artist collectibles. */
  artists: readonly ArtistSprout[];
  /** Every artist on Afterglow (to know which hand-made ones exist here, and each one's look). */
  catalogArtists: readonly { id: string; name: string }[];
  lookOf: (artistId: string) => ArtistLook | undefined;
  /** Creatures of the stickers you've found. */
  stickers: ReadonlySet<string>;
  /** Kandi given to you. */
  kandi: readonly { beads: PatternId; charm?: CharmId }[];
  /** Decorations you've earned for your garden. */
  decor?: readonly DecorId[];
  /** Holographic stickers you found (counted with the shiny ones). */
  holo?: number;
};

const set = (id: SetId, title: string, how: string, items: CollectionItem[]): CollectionSet => ({ id, title, how, items, have: items.filter((i) => i.have).length, total: items.length });

export function collection(input: CollectionInput): { sets: CollectionSet[]; have: number; total: number; shiny: number } {
  const mine = new Set(input.artists.map((a) => a.artistId));
  // The hand-made ones, one per signature artist on Afterglow (the first such artist if a name repeats).
  const signatureArtists = new Map<string, string>();
  for (const a of input.catalogArtists) {
    const k = foldName(a.name);
    if (SIGNATURE_NAMES.includes(k) && !signatureArtists.has(k)) signatureArtists.set(k, a.id);
  }
  // Sound creatures you have: the look of any collectible that isn't hand-made.
  const sounds = new Set<Creature>();
  for (const a of input.artists) {
    const look = input.lookOf(a.artistId);
    if (look && !look.signature) sounds.add(look.creature);
  }
  const beads = new Set(input.kandi.map((k) => k.beads));
  const charms = new Set(input.kandi.flatMap((k) => (k.charm ? [k.charm] : [])));
  const sets = [
    set('kinds', t('Sprout kinds'), t('Grow sprouts to bloom, or be given them'), SPROUT_KINDS.map((k) => ({ key: k.id, have: input.kinds.has(k.id) }))),
    set('signatures', t('Hand-made collectibles'), t('Film these artists’ sets'), [...signatureArtists.values()].map((id) => ({ key: id, have: mine.has(id) }))),
    set('sounds', t('Sound creatures'), t('Film any artist: their sound decides the creature'), SOUND_CREATURES.map((c) => ({ key: c, have: sounds.has(c) }))),
    set('stickers', t('Stickers'), t('Find them in the wild and scan them'), PLACE_CREATURES.map((c) => ({ key: c, have: input.stickers.has(c) }))),
    set('beads', t('Kandi beads'), t('Be given kandi in every pattern'), PATTERNS.map((p) => ({ key: p.id, have: beads.has(p.id) }))),
    set('charms', t('Kandi charms'), t('Be given kandi with every charm'), CHARMS.map((c) => ({ key: c.id, have: charms.has(c.id) }))),
    set('decor', t('Garden decorations'), t('Earn them for your garden’s sky'), DECOR.map((d) => ({ key: d.id, have: (input.decor ?? []).includes(d.id) }))),
  ].filter((s) => s.total > 0);
  const have = sets.reduce((n, s) => n + s.have, 0);
  const total = sets.reduce((n, s) => n + s.total, 0);
  return { sets, have, total, shiny: input.artists.filter((a) => a.shiny).length + (input.holo ?? 0) };
}
