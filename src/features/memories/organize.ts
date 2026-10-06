import type { Artist, Festival } from '../../data/models';
import type { Memory } from './models';
import { type PastEvent, pastKey, pastLabel } from './past';
import { showKey, showLabel } from './show';
import { formatTime } from '../festivals/format';
import { months, t, tn, weekdays } from '../../i18n';

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
  /** A throwback: a festival from before Afterglow. */
  past?: PastEvent;
  title: string;
  /** "Saturday and Sunday · 12 clips" style summary. */
  count: number;
  nights: MemoryNight[];
  /** The most recent capture in the section, for ordering. */
  latest: string;
};

export const UNTAGGED = 'untagged';
export const ELSEWHERE = 'elsewhere';
/** Sections for past festivals start with this. */
export const PAST = 'past:';
/** Sections for one-night shows start with this. */
export const SHOW = 'show:';

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
    if (!festival && !artist && !m.past && !m.show) {
      untagged.push(m);
      continue;
    }
    // A throwback is its own section (the festival and year), and so is a one-night show.
    const key = festival ? festival.id : m.past ? `${PAST}${pastKey(m.past)}` : m.show ? `${SHOW}${showKey(m.show)}` : ELSEWHERE;
    byFestival.set(key, [...(byFestival.get(key) ?? []), m]);
  }

  const sections: MemorySection[] = [];
  for (const [key, list] of byFestival) {
    const festival = key === ELSEWHERE || key.startsWith(PAST) || key.startsWith(SHOW) ? undefined : lookup.festival(key);
    const show = key.startsWith(SHOW) ? list[0].show : undefined;
    const past = key.startsWith(PAST) ? list[0].past : undefined;
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
      ...(past ? { past } : {}),
      title: festival?.name ?? (past ? pastLabel(past) : show ? showLabel(show) : t('Other sets')),
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
      title: t('Not tagged yet'),
      count: untagged.length,
      nights: [{ key: UNTAGGED, groups: [{ key: UNTAGGED, title: t('Not tagged yet'), memories: sorted }] }],
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
    const g = groups.get(key) ?? { key, artist: a, title: a?.name ?? t('Artist not tagged'), memories: [] };
    g.memories.push(m);
    groups.set(key, g);
  }
  // Groups in the order you first filmed them; an untagged artist last.
  return [...groups.values()].sort((x, y) => (!x.artist ? 1 : !y.artist ? -1 : x.memories[0].capturedAt.localeCompare(y.memories[0].capturedAt)));
}

/** "12 clips", "1 clip". */
export const clipCount = (n: number) => tn(n, '{n} clip', '{n} clips');

/** A memory's own line: "SUBTRONICS · Saturday · Solstice 2026". */
export function memoryLine(m: Memory, lookup: { festival: (id: string) => Festival | undefined; artist: (id: string) => Artist | undefined }): string {
  const parts = [m.artistId ? lookup.artist(m.artistId)?.name : undefined, m.night ? t(m.night) : undefined, m.festivalId ? lookup.festival(m.festivalId)?.name : undefined];
  return parts.filter(Boolean).join(' · ') || t('Not tagged yet');
}


/** "Sat, Jun 20 · 11:48 PM · Orlando": when and where a video was filmed, in the phone's time. */
export function momentLine(when: Date | undefined, place?: { city?: string; region?: string }): string {
  const parts: string[] = [];
  if (when && Number.isFinite(when.getTime())) {
    parts.push(t('{weekday}, {month} {day}', { weekday: weekdays(true)[when.getDay()], month: months(true)[when.getMonth()], day: when.getDate() }));
    parts.push(formatTime(`${when.getHours()}:${String(when.getMinutes()).padStart(2, '0')}`));
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
