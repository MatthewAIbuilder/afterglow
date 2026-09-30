import type { Artist, Festival } from '../../data/models';
import type { Memory } from './models';

/**
 * Memories arranged the way you remember them: by festival (most recent
 * first), then night in festival order, then artist in the order you filmed
 * them. Untagged memories come first under "Not tagged yet", so they're easy
 * to finish. Pure.
 */
export type MemoryGroup = { key: string; artist?: Artist; title: string; memories: Memory[] };
export type MemoryNight = { key: string; night?: string; title?: string; groups: MemoryGroup[] };
export type MemorySection = {
  key: string;
  festival?: Festival;
  title: string;
  /** "Saturday and Sunday · 12 clips" style summary. */
  count: number;
  nights: MemoryNight[];
  /** The most recent capture in the section, for ordering. */
  latest: string;
};

export const UNTAGGED = 'untagged';
export const ELSEWHERE = 'elsewhere';

const byCapture = (a: Memory, b: Memory) => a.capturedAt.localeCompare(b.capturedAt);

export function organizeMemories(
  memories: Memory[],
  lookup: { festival: (id: string) => Festival | undefined; artist: (id: string) => Artist | undefined },
): MemorySection[] {
  const untagged: Memory[] = [];
  const byFestival = new Map<string, Memory[]>();
  for (const m of memories) {
    const festival = m.festivalId ? lookup.festival(m.festivalId) : undefined;
    const artist = m.artistId ? lookup.artist(m.artistId) : undefined;
    if (!festival && !artist) {
      untagged.push(m);
      continue;
    }
    const key = festival ? festival.id : ELSEWHERE;
    byFestival.set(key, [...(byFestival.get(key) ?? []), m]);
  }

  const sections: MemorySection[] = [];
  for (const [key, list] of byFestival) {
    const festival = key === ELSEWHERE ? undefined : lookup.festival(key);
    const nightOrder = new Map((festival?.days ?? []).map((d, i) => [d, i]));
    const nights = new Map<string, Memory[]>();
    for (const m of list) {
      const n = m.night && (!festival || nightOrder.has(m.night)) ? m.night : '';
      nights.set(n, [...(nights.get(n) ?? []), m]);
    }
    const nightList: MemoryNight[] = [...nights.entries()]
      .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : (nightOrder.get(a) ?? 0) - (nightOrder.get(b) ?? 0)))
      .map(([night, ms]) => ({ key: `${key}:${night}`, night: night || undefined, title: night || undefined, groups: groupByArtist(`${key}:${night}`, ms, lookup.artist) }));
    sections.push({
      key,
      festival,
      title: festival?.name ?? 'Other sets',
      count: list.length,
      nights: nightList,
      latest: list.map((m) => m.capturedAt).sort().at(-1) ?? '',
    });
  }
  sections.sort((a, b) => b.latest.localeCompare(a.latest));
  if (untagged.length) {
    const sorted = [...untagged].sort(byCapture);
    sections.unshift({
      key: UNTAGGED,
      title: 'Not tagged yet',
      count: untagged.length,
      nights: [{ key: UNTAGGED, groups: [{ key: UNTAGGED, title: 'Not tagged yet', memories: sorted }] }],
      latest: sorted.at(-1)?.capturedAt ?? '',
    });
  }
  return sections;
}

function groupByArtist(prefix: string, memories: Memory[], artist: (id: string) => Artist | undefined): MemoryGroup[] {
  const groups = new Map<string, MemoryGroup>();
  for (const m of [...memories].sort(byCapture)) {
    const a = m.artistId ? artist(m.artistId) : undefined;
    const key = `${prefix}:${a?.id ?? ''}`;
    const g = groups.get(key) ?? { key, artist: a, title: a?.name ?? 'Artist not tagged', memories: [] };
    g.memories.push(m);
    groups.set(key, g);
  }
  // Groups in the order you first filmed them; an untagged artist last.
  return [...groups.values()].sort((x, y) => (!x.artist ? 1 : !y.artist ? -1 : x.memories[0].capturedAt.localeCompare(y.memories[0].capturedAt)));
}

/** "12 clips", "1 clip". */
export const clipCount = (n: number) => `${n} ${n === 1 ? 'clip' : 'clips'}`;

/** A memory's own line: "SUBTRONICS · Saturday · Solstice 2026". */
export function memoryLine(m: Memory, lookup: { festival: (id: string) => Festival | undefined; artist: (id: string) => Artist | undefined }): string {
  const parts = [m.artistId ? lookup.artist(m.artistId)?.name : undefined, m.night, m.festivalId ? lookup.festival(m.festivalId)?.name : undefined];
  return parts.filter(Boolean).join(' · ') || 'Not tagged yet';
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sat, Jun 20 · 11:48 PM · Orlando": when and where a video was filmed, in the phone's time. */
export function momentLine(when: Date | undefined, place?: { city?: string; region?: string }): string {
  const parts: string[] = [];
  if (when && Number.isFinite(when.getTime())) {
    const h = when.getHours();
    parts.push(`${DAY[when.getDay()]}, ${MONTH[when.getMonth()]} ${when.getDate()}`);
    parts.push(`${h % 12 === 0 ? 12 : h % 12}:${String(when.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`);
  }
  const where = place?.city ?? place?.region;
  if (where) parts.push(where);
  return parts.join(' · ');
}

/** "0:42", "2:05". */
export function clipLength(sec: number | undefined): string | undefined {
  if (!sec || !Number.isFinite(sec)) return undefined;
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
