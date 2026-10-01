import type { Festival } from '../../data/models';
import type { Pick as PlanPick } from './plan';

/**
 * Your own lineup poster: the festival's acts you'd love, set like a real
 * poster, with your favourites as headliners and the rest in smaller rows.
 * Pure: takes your ranked picks (`rankLineup`) and lays out the rows.
 *
 * Who makes it: must-sees and strong matches, then explore picks you have
 * real signal for (a poster of guesses would say nothing about you). Rows:
 * up to `TOP` headliners, then `MID` names, then up to `REST` more; "and N
 * more" when there were others.
 */
export const POSTER_TOP = 2;
export const POSTER_MID = 6;
export const POSTER_REST = 18;

export type LineupPoster = {
  festival: string;
  subtitle: string;
  /** Rows, biggest first: headliners, second line, the rest. Each a list of names. */
  rows: { size: 'top' | 'mid' | 'rest'; names: { name: string; star: boolean }[] }[];
  more: number;
  /** How many acts made it, for the screen reader. */
  count: number;
};

export function lineupPoster(festival: Pick<Festival, 'name' | 'dates' | 'location'>, picks: readonly PlanPick[]): LineupPoster | undefined {
  const chosen = picks.filter((p) => p.tier !== 'explore' || p.known);
  if (!chosen.length) return undefined;
  // Starred first among equals: they're your headliners.
  const order = [...chosen].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const name = (p: PlanPick) => ({ name: p.artist.name, star: p.pinned });
  const top = order.slice(0, POSTER_TOP);
  const mid = order.slice(POSTER_TOP, POSTER_TOP + POSTER_MID);
  const rest = order.slice(POSTER_TOP + POSTER_MID, POSTER_TOP + POSTER_MID + POSTER_REST);
  const rows: LineupPoster['rows'] = [
    { size: 'top', names: top.map(name) },
    ...(mid.length ? [{ size: 'mid' as const, names: mid.map(name) }] : []),
    ...(rest.length ? [{ size: 'rest' as const, names: rest.map(name) }] : []),
  ];
  const where = [festival.dates, festival.location].filter(Boolean).join(' · ');
  return {
    festival: festival.name,
    subtitle: where,
    rows,
    more: Math.max(0, order.length - POSTER_TOP - POSTER_MID - POSTER_REST),
    count: Math.min(order.length, POSTER_TOP + POSTER_MID + POSTER_REST),
  };
}

/** The poster as a message. */
export function lineupPosterText(p: LineupPoster): string {
  const parts = [`My ${p.festival} lineup`, p.subtitle, ''];
  for (const r of p.rows) parts.push(r.names.map((n) => n.name).join(' · '));
  if (p.more) parts.push(`and ${p.more} more`);
  parts.push('', 'Made with Afterglow');
  return parts.filter((x, i) => x || i > 1).join('\n');
}
