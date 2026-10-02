import { space } from '../../theme/tokens';

/**
 * Placement for vertical footage (official Shorts): a tall 9:16 player with
 * the action rail beside it and the clip info below. Pure, so the one rule
 * that matters is tested: nothing of ours ever sits on top of the player.
 *
 * Horizontal footage keeps the stacked card (player, info, actions in a row),
 * and so does vertical footage on a screen too small for this.
 */

export type Rect = { x: number; y: number; w: number; h: number };

export type TallLayout = { player: Rect; rail: Rect; info: Rect };

/** YouTube's embedded player must be at least 200 by 200. */
export const MIN_PLAYER = 200;
/** Three rail buttons (like, save, skip): 50 icon + 5 gap + 15 label each, 24 between. */
export const RAIL = { w: 64, h: 3 * 70 + 2 * space.xl } as const;
/** Artist row, one-line title, meta and credit. */
export const INFO_H = 132;

const GUTTER = space.lg;

type Input = {
  width: number;
  height: number;
  /** First usable y below the feed header. */
  top: number;
  /** Space kept clear at the bottom for the tab bar. */
  bottom: number;
};

export function tallLayout({ width, height, top, bottom }: Input): TallLayout | undefined {
  const availW = width - GUTTER * 2 - RAIL.w - space.md;
  const availH = height - top - bottom - INFO_H - space.md;
  const h = Math.floor(Math.min(availH, (availW * 16) / 9));
  const w = Math.floor((h * 9) / 16);
  if (w < MIN_PLAYER || h < MIN_PLAYER) return undefined;
  const player = { x: GUTTER, y: top, w, h };
  const railX = width - GUTTER - RAIL.w;
  return {
    player,
    rail: { x: railX, y: Math.max(top, top + h - RAIL.h), w: RAIL.w, h: RAIL.h },
    info: { x: GUTTER, y: top + h + space.md, w: width - GUTTER * 2, h: INFO_H },
  };
}

export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Upright videos filmed by people on Afterglow fill the whole screen, TikTok
 * style, with the clip info and buttons over the bottom. Only our own videos:
 * YouTube's player mustn't be covered or cropped, so official clips keep the
 * layouts above.
 */
export const fillsScreen = (media: { provider: string; vertical?: boolean }) => media.provider === 'video' && !!media.vertical;
