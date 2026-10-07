import { t } from '../../i18n';
import type { ArtistSprout } from './artistSprouts';
import type { SproutKind } from './sprouts';

/**
 * Garden decorations, pure: things in your garden's sky you earn by what you
 * do (giving, festivals, luck, kandi), shown to you and to anyone visiting.
 */
export type DecorId = 'lights' | 'bunting' | 'moon' | 'rainbow' | 'lanterns' | 'aurora' | 'stars' | 'fireworks' | 'constellation' | 'portal';

export const DECOR: readonly { id: DecorId; name: string; how: string }[] = [
  { id: 'lights', name: t('Fairy lights'), how: t('Give 10 sprouts that people pick up') },
  { id: 'bunting', name: t('Festival bunting'), how: t('Grow a Wanderer sprout from festival days') },
  { id: 'moon', name: t('The moon'), how: t('Grow a Moonlight sprout') },
  { id: 'rainbow', name: t('A rainbow'), how: t('Find a shiny collectible') },
  { id: 'lanterns', name: t('Paper lanterns'), how: t('Be given 5 kandi') },
  { id: 'aurora', name: t('The aurora'), how: t('Film an artist up to gold') },
  { id: 'stars', name: t('Shooting stars'), how: t('Pin 3 cards to your profile') },
  { id: 'fireworks', name: t('Fireworks'), how: t('Complete a set in Your collection') },
  { id: 'constellation', name: t('A constellation'), how: t('Grow a Seeker sprout') },
  { id: 'portal', name: t('A portal'), how: t('Find the Portal potty') },
];

/** Each decoration's two colours (for its moment when it's earned). */
export const DECOR_COLORS: Record<DecorId, readonly [string, string]> = {
  lights: ['#FFE58A', '#FF8AD8'],
  bunting: ['#FF8A6B', '#6AD7FF'],
  moon: ['#FFF3C8', '#B99CFF'],
  rainbow: ['#FF8AD8', '#8AFFD0'],
  lanterns: ['#FFB86B', '#FF5E7E'],
  aurora: ['#5BE3B5', '#B99CFF'],
  stars: ['#E8F4FF', '#8AB8FF'],
  fireworks: ['#FF6AD5', '#FFE58A'],
  constellation: ['#FFC94A', '#CFE8FF'],
  portal: ['#B6FF5A', '#3A86E0'],
};

export const isDecor = (v: unknown): v is DecorId => DECOR.some((d) => d.id === v);

export function decorFor(i: { given: number; kinds: ReadonlySet<SproutKind>; artists: readonly ArtistSprout[]; kandi: number; pinned?: number; completeSets?: number; portal?: boolean }): DecorId[] {
  const on: Record<DecorId, boolean> = {
    lights: i.given >= 10,
    bunting: i.kinds.has('wanderer'),
    moon: i.kinds.has('moonlight'),
    rainbow: i.artists.some((a) => a.shiny),
    lanterns: i.kandi >= 5,
    aurora: i.artists.some((a) => a.tier === 3),
    stars: (i.pinned ?? 0) >= 3,
    fireworks: (i.completeSets ?? 0) >= 1,
    constellation: i.kinds.has('seeker'),
    portal: !!i.portal,
  };
  return DECOR.map((d) => d.id).filter((id) => on[id]);
}

/** Decorations read back from a published garden: known ones, once each. */
export const cleanDecor = (raw: unknown): DecorId[] => (Array.isArray(raw) ? [...new Set(raw.filter(isDecor))] : []);
