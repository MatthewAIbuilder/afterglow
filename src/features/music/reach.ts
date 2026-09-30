import type { Festival } from '../../data/models';
import { nextRun, runsOf } from '../festivals/when';
import type { MusicProviderId } from './models';

/**
 * How far a library reaches into Afterglow's festivals. Pure.
 *
 * A festival counts as upcoming until its last day is over; one with no
 * dates yet counts too (its lineup is out, its dates are still to come).
 */
export const isUpcoming = (festival: Festival, today: Date) => !runsOf(festival).length || !!nextRun(festival, today);

/** Of these Afterglow artists, how many play at least one upcoming festival. */
export function onUpcomingFestivals(artistIds: Iterable<string>, festivals: Festival[], today: Date): number {
  const playing = new Set<string>();
  for (const f of festivals) if (isUpcoming(f, today)) for (const id of f.lineup) playing.add(id);
  let n = 0;
  for (const id of new Set(artistIds)) if (playing.has(id)) n++;
  return n;
}

/** The Afterglow artists each service's library brought in (from `ImportedMusic.from`). */
export function matchedBy(from: Record<string, MusicProviderId[]>, provider: MusicProviderId): string[] {
  return Object.entries(from)
    .filter(([, ps]) => ps.includes(provider))
    .map(([id]) => id);
}
