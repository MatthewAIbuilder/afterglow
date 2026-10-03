import type { Festival, SoundTag } from '../../data/models';
import type { SoundShare } from '../taste/lean';
import { STRONG_MATCH, tasteMatch } from './match';
import type { Profile, SharedMemory } from './models';

/**
 * What the people you follow have been up to, from what they chose to share:
 * moments they shared, festivals they're going to, and anyone whose taste is
 * close to yours. Pure.
 */
export type ActivityItem =
  | { kind: 'moment'; id: string; profile: Profile; memory: SharedMemory; at: number }
  | { kind: 'going'; id: string; profile: Profile; festival: Festival }
  | { kind: 'match'; id: string; profile: Profile; percent: number };

/** Shared moments this recent count as news. */
export const MOMENT_DAYS = 14;
export const ACTIVITY_MAX = 12;

type Input = {
  profiles: readonly Profile[];
  memories: readonly SharedMemory[];
  /** A festival still to come (undefined when unknown or over). */
  upcoming: (festivalId: string) => Festival | undefined;
  mine: { sounds: readonly SoundShare[]; going: readonly string[] };
  blocked: ReadonlySet<string>;
  now: number;
};

const dateOf = (f: Festival) => f.startDate ?? '9999';

export function friendActivity({ profiles, memories, upcoming, mine, blocked, now }: Input, max = ACTIVITY_MAX): ActivityItem[] {
  const people = new Map(profiles.filter((p) => !blocked.has(p.uid)).map((p) => [p.uid, p]));
  const since = now - MOMENT_DAYS * 86_400_000;

  const moments: ActivityItem[] = [];
  const seenMoment = new Set<string>();
  for (const m of memories) {
    const p = people.get(m.uid);
    const at = Date.parse(m.createdAt);
    if (!p || !Number.isFinite(at) || at < since || seenMoment.has(m.id)) continue;
    seenMoment.add(m.id);
    moments.push({ kind: 'moment', id: `moment:${m.id}`, profile: p, memory: m, at });
  }
  moments.sort((a, b) => (b as { at: number }).at - (a as { at: number }).at);

  // Each person once, at the soonest festival they show.
  const going: (ActivityItem & { kind: 'going' })[] = [];
  for (const p of people.values()) {
    const next = p.festivals.map(upcoming).filter((f): f is Festival => !!f).sort((a, b) => dateOf(a).localeCompare(dateOf(b)))[0];
    if (next) going.push({ kind: 'going', id: `going:${p.uid}:${next.id}`, profile: p, festival: next });
  }
  going.sort((a, b) => dateOf(a.festival).localeCompare(dateOf(b.festival)) || a.profile.displayName.localeCompare(b.profile.displayName));

  const myGoing = new Set(mine.going);
  const matches: (ActivityItem & { kind: 'match' })[] = [];
  for (const p of people.values()) {
    const percent = tasteMatch(mine.sounds, p.sounds as SoundTag[], p.festivals.filter((f) => myGoing.has(f)).length);
    if (percent !== undefined && percent >= STRONG_MATCH) matches.push({ kind: 'match', id: `match:${p.uid}`, profile: p, percent });
  }
  matches.sort((a, b) => b.percent - a.percent);

  return [...moments.slice(0, 6), ...going.slice(0, 4), ...matches.slice(0, 3)].slice(0, max);
}

/** "Just now", "12 min ago", "3 h ago", "Yesterday", "4 days ago". */
export function shortAgo(at: number, now: number): string {
  const m = Math.max(0, Math.floor((now - at) / 60000));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
}

/** What a line of activity says, for the list and for screen readers. */
export function activityText(item: ActivityItem, artistName: (id: string) => string | undefined): string {
  const who = item.profile.displayName;
  if (item.kind === 'moment') {
    const artist = item.memory.artistId ? artistName(item.memory.artistId) : undefined;
    return `${who} shared a moment${artist ? ` of ${artist}` : ''}`;
  }
  if (item.kind === 'going') return `${who} is going to ${item.festival.name}`;
  return `You and ${who} have a ${item.percent}% taste match`;
}
