import type { Festival } from '../../data/models';
import type { SharedMemory } from '../social/models';

/**
 * A festival's videos from the crowd, organised, pure: night by night in the
 * festival's own order (videos without a night last), newest first within a
 * night, never anyone blocked or a hidden video; and the artists filmed most,
 * for a filter.
 */

export type CrowdNight = { night: string; videos: SharedMemory[] };

/** "Other nights" for videos tagged with no night (or one the festival doesn't have). */
export const OTHER_NIGHT = 'Other nights';

export function crowdVideos(memories: readonly SharedMemory[], { blocked = [], hidden = [] }: { blocked?: readonly string[]; hidden?: readonly string[] } = {}): SharedMemory[] {
  const seen = new Set<string>();
  return memories.filter((m) => {
    if (seen.has(m.id) || blocked.includes(m.uid) || hidden.includes(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export function crowdByNight(memories: readonly SharedMemory[], festival: Pick<Festival, 'days'>, artistId?: string): CrowdNight[] {
  const list = artistId ? memories.filter((m) => m.artistId === artistId) : memories;
  const nights = new Map<string, SharedMemory[]>();
  for (const m of list) {
    const night = m.night && festival.days.includes(m.night) ? m.night : OTHER_NIGHT;
    nights.set(night, [...(nights.get(night) ?? []), m]);
  }
  const order = [...festival.days, OTHER_NIGHT];
  return order
    .filter((n) => nights.has(n))
    .map((night) => ({ night, videos: [...nights.get(night)!].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)) }));
}

/** The artists filmed most (at least two videos), most first, up to `max`. */
export function crowdArtists(memories: readonly SharedMemory[], max = 8): { artistId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of memories) if (m.artistId) counts.set(m.artistId, (counts.get(m.artistId) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([artistId, count]) => ({ artistId, count }));
}

/** "12 videos from 5 people". */
export function crowdLine(memories: readonly SharedMemory[]): string {
  const people = new Set(memories.map((m) => m.uid)).size;
  return `${memories.length} ${memories.length === 1 ? 'video' : 'videos'} from ${people} ${people === 1 ? 'person' : 'people'}`;
}
