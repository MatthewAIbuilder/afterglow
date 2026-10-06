import { hashOf } from './artistLook';

/**
 * The living garden's ground plan. Pure.
 *
 * The meadow is rows of "spots" across the width of the page (3 across on a
 * phone, up to `MAX_COLS` on a wide page), each a little off its grid line so
 * it reads as a meadow, not a chart. Every resident (a plain sprout or an
 * artist collectible) stands at one spot; you can pick one up and move it,
 * and where it stands is kept per account (`state/gardenLayout.ts`). New
 * arrivals take the first free spot from the middle of each row outwards;
 * one freed by a creature that's gone is free again. There's always at least
 * one free spot, so there's room to move something.
 */

export type Spot = {
  x: number;
  /** Where its feet stand. */
  y: number;
  row: number;
  col: number;
  /** 0 at the back row (by the horizon) to 1 at the front. */
  depth: number;
};
export type Meadow = { cols: number; rows: number; colWidth: number; height: number; spots: Spot[] };
/** Which spot each resident stands at. */
export type Placement = Record<string, number>;

/** A spot needs about this much width (a creature up to 96 pt and its name). */
export const SPOT_MIN_WIDTH = 108;
export const MAX_COLS = 5;
/** A row: the tallest creature (96) plus its name and bar under it. */
export const ROW_HEIGHT = 124;
/** Sky and the rolling horizon above the back row. */
export const HORIZON = 54;
export const BOTTOM = 26;
/** The tallest creature: its feet stand this far below the top of its row. */
const STAND = 96;

export function colsFor(width: number): number {
  return Math.max(2, Math.min(MAX_COLS, Math.floor(width / SPOT_MIN_WIDTH)));
}

/** Rows for `count` residents: always one spare spot, so something can be moved. */
export function rowsFor(count: number, cols: number): number {
  return Math.max(1, Math.ceil((count + 1) / cols));
}

/** The meadow for `count` residents across `width` points. */
export function meadow(count: number, width: number): Meadow {
  const cols = colsFor(width);
  const rows = rowsFor(count, cols);
  const colWidth = width / cols;
  const spots: Spot[] = [];
  for (let i = 0; i < cols * rows; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    // A little off the grid, the same every time.
    const jx = ((hashOf(`spot${i}`) % 1000) / 1000 - 0.5) * colWidth * 0.18;
    const jy = ((hashOf(`row${i}`) % 1000) / 1000 - 0.5) * 12;
    spots.push({ x: colWidth * (col + 0.5) + jx, y: HORIZON + row * ROW_HEIGHT + STAND + jy, row, col, depth: rows > 1 ? row / (rows - 1) : 1 });
  }
  return { cols, rows, colWidth, height: HORIZON + rows * ROW_HEIGHT + BOTTOM, spots };
}

/** Spots in the order new arrivals take them: row by row, from the middle of each row outwards. */
export function spotOrder(cols: number, rows: number): number[] {
  const out: number[] = [];
  for (let row = 0; row < rows; row++) {
    const mid = (cols - 1) / 2;
    const columns = Array.from({ length: cols }, (_, c) => c).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
    for (const c of columns) out.push(row * cols + c);
  }
  return out;
}

/**
 * Where everyone stands: what was saved when it still fits (a spot that
 * exists, not taken by someone saved earlier in `ids`), else the first free
 * spot. Residents no longer there are left out, so their spots are free.
 */
export function placeResidents(ids: readonly string[], stored: Readonly<Placement> | undefined, m: Pick<Meadow, 'cols' | 'rows'>): Placement {
  const count = m.cols * m.rows;
  const out: Placement = {};
  const taken = new Set<number>();
  for (const id of ids) {
    const s = stored?.[id];
    if (s !== undefined && Number.isInteger(s) && s >= 0 && s < count && !taken.has(s)) {
      out[id] = s;
      taken.add(s);
    }
  }
  const order = spotOrder(m.cols, m.rows);
  for (const id of ids) {
    if (out[id] !== undefined) continue;
    const free = order.find((i) => !taken.has(i));
    // There's always a spare spot; the last resort keeps the layout whole.
    const s = free ?? count;
    out[id] = s;
    taken.add(s);
  }
  return out;
}

/** `id` moves to `spot`; whoever stood there takes its old spot. */
export function moveTo(placement: Readonly<Placement>, id: string, spot: number): Placement {
  const from = placement[id];
  if (from === undefined || from === spot) return { ...placement };
  const out: Placement = { ...placement, [id]: spot };
  for (const [other, at] of Object.entries(placement)) if (other !== id && at === spot) out[other] = from;
  return out;
}

/** The spot nearest a point (where something was dropped). Runs on the UI thread too. */
export function nearestSpot(spots: readonly { x: number; y: number }[], x: number, y: number): number {
  'worklet';
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < spots.length; i++) {
    const dx = spots[i].x - x;
    const dy = spots[i].y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export const samePlacement = (a: Readonly<Placement> | undefined, b: Readonly<Placement>): boolean => {
  if (!a) return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

const ACCOUNTS_MAX = 20;
const RESIDENTS_MAX = 500;
const ID_MAX = 120;

/** Saved layouts read back (`{ [account]: { [residentId]: spot } }`), dropping anything malformed. */
export function cleanLayouts(raw: unknown): Record<string, Placement> {
  const out: Record<string, Placement> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [account, value] of Object.entries(raw as Record<string, unknown>).slice(0, ACCOUNTS_MAX)) {
    if (!account || account.length > ID_MAX || !value || typeof value !== 'object') continue;
    const placement: Placement = {};
    for (const [id, spot] of Object.entries(value as Record<string, unknown>).slice(0, RESIDENTS_MAX))
      if (id && id.length <= ID_MAX && typeof spot === 'number' && Number.isInteger(spot) && spot >= 0 && spot < 10_000) placement[id] = spot;
    out[account] = placement;
  }
  return out;
}
