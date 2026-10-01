import type { Festival } from '../../data/models';
import { bySoonest, isOver } from './shelves';

/**
 * An artist's festivals in the order that helps you most: ones you're going
 * to, then ones near you (nearest first) when you've turned Near you on,
 * then the rest soonest first; those that are over come last (in
 * `bySoonest`'s order). Pure.
 */
export type Playing = { festival: Festival; going: boolean; over: boolean; km?: number };

export function playingList(
  festivals: readonly Festival[],
  opts: { going: readonly string[]; today: Date; distanceTo?: (f: Festival) => number | undefined; nearKm?: number },
): Playing[] {
  const soonest = bySoonest(festivals, opts.today);
  const order = new Map(soonest.map((f, i) => [f.id, i]));
  const near = opts.nearKm ?? Number.POSITIVE_INFINITY;
  const items = festivals.map((festival): Playing => {
    const km = opts.distanceTo?.(festival);
    return { festival, going: opts.going.includes(festival.id), over: isOver(festival, opts.today), ...(km !== undefined ? { km } : {}) };
  });
  const rank = (p: Playing) => (p.over ? 3 : p.going ? 0 : p.km !== undefined && p.km <= near ? 1 : 2);
  return items.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (rank(a) === 1 ? a.km! - b.km! : 0) ||
      order.get(a.festival.id)! - order.get(b.festival.id)!,
  );
}
