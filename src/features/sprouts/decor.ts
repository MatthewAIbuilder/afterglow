import { t } from '../../i18n';
import type { ArtistSprout } from './artistSprouts';
import type { SproutKind } from './sprouts';

/**
 * Garden decorations, pure: things in your garden's sky you earn by what you
 * do (giving, festivals, luck, kandi), shown to you and to anyone visiting.
 */
export type DecorId = 'lights' | 'bunting' | 'moon' | 'rainbow' | 'lanterns' | 'aurora';

export const DECOR: readonly { id: DecorId; name: string; how: string }[] = [
  { id: 'lights', name: t('Fairy lights'), how: t('Give 10 sprouts that people pick up') },
  { id: 'bunting', name: t('Festival bunting'), how: t('Grow a Wanderer sprout from festival days') },
  { id: 'moon', name: t('The moon'), how: t('Grow a Moonlight sprout') },
  { id: 'rainbow', name: t('A rainbow'), how: t('Find a shiny collectible') },
  { id: 'lanterns', name: t('Paper lanterns'), how: t('Be given 5 kandi') },
  { id: 'aurora', name: t('The aurora'), how: t('Film an artist up to gold') },
];

export const isDecor = (v: unknown): v is DecorId => DECOR.some((d) => d.id === v);

export function decorFor(i: { given: number; kinds: ReadonlySet<SproutKind>; artists: readonly ArtistSprout[]; kandi: number }): DecorId[] {
  const on: Record<DecorId, boolean> = {
    lights: i.given >= 10,
    bunting: i.kinds.has('wanderer'),
    moon: i.kinds.has('moonlight'),
    rainbow: i.artists.some((a) => a.shiny),
    lanterns: i.kandi >= 5,
    aurora: i.artists.some((a) => a.tier === 3),
  };
  return DECOR.map((d) => d.id).filter((id) => on[id]);
}

/** Decorations read back from a published garden: known ones, once each. */
export const cleanDecor = (raw: unknown): DecorId[] => (Array.isArray(raw) ? [...new Set(raw.filter(isDecor))] : []);
