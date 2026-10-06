import type { Artist, Festival } from '../../data/models';
import { allArtists } from '../memories/b2b';
import type { Memory } from '../memories/models';
import { pastKey, pastLabel } from '../memories/past';
import { showKey, showLabel } from '../memories/show';

/**
 * Quick filters for Moments on a profile, pure: everything (newest first),
 * one artist (b2b partners count too), one festival, throwback or show, or
 * the videos you're tagged in. The choices only list what's there, the most
 * videos first.
 */
export type MomentFilter = { kind: 'all' } | { kind: 'artist'; id?: string } | { kind: 'place'; key?: string } | { kind: 'tagged' };

export type FilterChoice = { key: string; label: string; count: number };

type Lookup = { festival: (id: string) => Festival | undefined; artist: (id: string) => Artist | undefined };

/** Where a video is from, as one key: a festival's id, `past:<key>` or `show:<key>`. */
export function placeKey(m: Pick<Memory, 'festivalId' | 'past' | 'show'>): string | undefined {
  if (m.festivalId) return m.festivalId;
  if (m.past) return `past:${pastKey(m.past)}`;
  if (m.show) return `show:${showKey(m.show)}`;
  return undefined;
}

function byCount(counts: Map<string, { label: string; count: number; latest: string }>): FilterChoice[] {
  return [...counts.entries()]
    .map(([key, v]) => ({ key, label: v.label, count: v.count, latest: v.latest }))
    .sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest) || a.label.localeCompare(b.label))
    .map(({ key, label, count }) => ({ key, label, count }));
}

/** The artists in these videos, the most videos first. */
export function artistChoices(memories: readonly Memory[], lookup: Lookup): FilterChoice[] {
  const counts = new Map<string, { label: string; count: number; latest: string }>();
  for (const m of memories)
    for (const id of allArtists(m)) {
      const name = lookup.artist(id)?.name;
      if (!name) continue;
      const c = counts.get(id) ?? { label: name, count: 0, latest: '' };
      c.count += 1;
      if (m.capturedAt > c.latest) c.latest = m.capturedAt;
      counts.set(id, c);
    }
  return byCount(counts);
}

/** The festivals, throwbacks and shows these videos are from, the most videos first. */
export function placeChoices(memories: readonly Memory[], lookup: Lookup): FilterChoice[] {
  const counts = new Map<string, { label: string; count: number; latest: string }>();
  for (const m of memories) {
    const key = placeKey(m);
    if (!key) continue;
    const label = m.festivalId ? lookup.festival(m.festivalId)?.name : m.past ? pastLabel(m.past) : m.show ? showLabel(m.show) : undefined;
    if (!label) continue;
    const c = counts.get(key) ?? { label, count: 0, latest: '' };
    c.count += 1;
    if (m.capturedAt > c.latest) c.latest = m.capturedAt;
    counts.set(key, c);
  }
  return byCount(counts);
}

/** The videos a filter shows, newest first. Your own for everything but `tagged`, which shows the ones you're tagged in. */
export function applyMomentFilter(mine: readonly Memory[], tagged: readonly Memory[], f: MomentFilter): Memory[] {
  const newest = (list: readonly Memory[]) => [...list].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  if (f.kind === 'tagged') return newest(tagged);
  if (f.kind === 'artist' && f.id) return newest(mine.filter((m) => allArtists(m).includes(f.id!)));
  if (f.kind === 'place' && f.key) return newest(mine.filter((m) => placeKey(m) === f.key));
  return [...mine];
}
