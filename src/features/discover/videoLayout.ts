import { space } from '../../theme/tokens';

/**
 * Where the pieces of a real-footage card go. Pure, so the one rule that
 * matters can be tested: nothing of ours ever sits on top of the player.
 *
 * - beside: vertical footage (Shorts). A tall player with the action rail to
 *   its right and the clip info below it.
 * - centered: horizontal footage. The player centred in the space above the
 *   rail, rail bottom right and info bottom left, as on the stage cards.
 * - stacked: fallback for screens too short for the above. Player, then info,
 *   then the actions in a row.
 */

export type Rect = { x: number; y: number; w: number; h: number };

export type VideoLayout =
  | { mode: 'beside' | 'centered'; player: Rect; rail: Rect; info: Rect }
  | { mode: 'stacked'; player: Rect };

/** YouTube's embedded player must be at least 200 by 200. */
export const MIN_PLAYER = 200;
/** Tight action rail with four buttons (source badge, like, save, skip): 50 icon + 5 gap + 15 label each, 16 between. */
export const RAIL = { w: 64, h: 4 * 70 + 3 * space.lg } as const;
/** Artist row, title, meta and credit. */
export const INFO_H = 132;

const GUTTER = space.lg;

type Input = {
  width: number;
  height: number;
  /** First usable y below the feed header. */
  top: number;
  /** Space kept clear at the bottom for the tab bar. */
  bottom: number;
  vertical: boolean;
};

export function videoLayout({ width, height, top, bottom, vertical }: Input): VideoLayout {
  if (vertical) {
    const availW = width - GUTTER * 2 - RAIL.w - space.md;
    const availH = height - top - bottom - INFO_H - space.md;
    const h = Math.floor(Math.min(availH, (availW * 16) / 9));
    const w = Math.floor((h * 9) / 16);
    if (w >= MIN_PLAYER && h >= MIN_PLAYER) {
      const player = { x: GUTTER, y: top, w, h };
      const railX = width - GUTTER - RAIL.w;
      return {
        mode: 'beside',
        player,
        rail: { x: railX, y: Math.max(top, top + h - RAIL.h), w: RAIL.w, h: RAIL.h },
        info: { x: GUTTER, y: top + h + space.md, w: width - GUTTER * 2, h: INFO_H },
      };
    }
  } else {
    const w = width - space.md * 2;
    const h = Math.max(MIN_PLAYER, Math.round((w * 9) / 16));
    const rail = { x: width - GUTTER - RAIL.w, y: height - bottom - RAIL.h, w: RAIL.w, h: RAIL.h };
    const areaBottom = rail.y - space.lg;
    if (areaBottom - top >= h) {
      return {
        mode: 'centered',
        player: { x: space.md, y: Math.round(top + (areaBottom - top - h) / 2), w, h },
        rail,
        info: { x: GUTTER, y: height - bottom - INFO_H, w: rail.x - space.md - GUTTER, h: INFO_H },
      };
    }
  }

  const w = width - GUTTER * 2;
  return { mode: 'stacked', player: { x: GUTTER, y: top, w, h: Math.max(MIN_PLAYER, Math.round((w * 9) / 16)) } };
}

export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
