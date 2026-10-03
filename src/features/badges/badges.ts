import type { Festival } from '../../data/models';
import { festivalMark } from '../profile/profileView';
import type { SharedMemory } from '../social/models';
import { runsOf } from '../festivals/when';

/**
 * Festival badges, pure: a collectible enamel pin for every festival, earned
 * by sharing a video tagged with that festival and filmed there, on its
 * dates (from the video's own time; the morning after the last day counts,
 * since nights run past midnight). Worked out from the videos someone has
 * shared, so anyone can see anyone's badges and nobody can just claim one.
 */

export type Badge = {
  festivalId: string;
  /** When the first video that earned it was filmed (ISO). */
  earnedAt: string;
  /** How many shared videos were filmed there. */
  videos: number;
  /** The first of them, to watch from the badge. */
  firstId: string;
};

/** "YYYY-MM-DD" for a moment, in this phone's time. */
const localDay = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dayAfter = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const n = new Date(y, m - 1, d + 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

/** Filmed during the festival: on one of its days (either weekend), or the morning after one. */
export function filmedThere(festival: Pick<Festival, 'startDate' | 'endDate' | 'weekends'>, capturedAt: string): boolean {
  const day = localDay(capturedAt);
  if (!day) return false;
  return runsOf(festival as Festival).some((r) => day >= r.start && day <= dayAfter(r.end));
}

/** The badges a set of shared videos earn, the most recently earned first. */
export function earnedBadges(memories: readonly SharedMemory[], festivalOf: (id: string) => Festival | undefined): Badge[] {
  const byFestival = new Map<string, SharedMemory[]>();
  for (const m of memories) {
    const f = m.festivalId ? festivalOf(m.festivalId) : undefined;
    if (!f || !filmedThere(f, m.capturedAt)) continue;
    byFestival.set(f.id, [...(byFestival.get(f.id) ?? []), m]);
  }
  return [...byFestival.entries()]
    .map(([festivalId, list]) => {
      const first = [...list].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))[0];
      return { festivalId, earnedAt: first.capturedAt, videos: list.length, firstId: first.id };
    })
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
}

/** Festivals you're going to that aren't over and whose badge you haven't earned: the ones to collect. */
export function toCollect(going: readonly Festival[], earned: readonly Badge[], today: Date): Festival[] {
  const have = new Set(earned.map((b) => b.festivalId));
  const t = localDay(today.toISOString()) ?? '';
  return going.filter((f) => !have.has(f.id) && runsOf(f).some((r) => dayAfter(r.end) >= t));
}

export type PinShape = 'circle' | 'shield' | 'hexagon' | 'diamond' | 'burst';
export type PinMotif = 'rays' | 'waves' | 'peaks' | 'stars' | 'rings';
export type PinLook = {
  shape: PinShape;
  motif: PinMotif;
  /** The enamel: two colours that blend across the face. */
  enamel: readonly [string, string];
  /** The festival's mark ("CC4", "EDC") and year. */
  mark: string;
  year?: string;
};

/** Enamel colours that look right as a pin at night, each pair hand-picked. */
export const ENAMELS: readonly (readonly [string, string])[] = [
  ['#7B3FE4', '#FF7EB6'],
  ['#1E6BFF', '#5BE3B5'],
  ['#FF6B3D', '#FFD166'],
  ['#0FB5AE', '#2B2D9E'],
  ['#E23A6A', '#6A2CF0'],
  ['#14213D', '#FCA311'],
  ['#3A0CA3', '#4CC9F0'],
  ['#D00000', '#FFBA08'],
  ['#2D6A4F', '#B7E4C7'],
  ['#5F0F40', '#FB8B24'],
];
const SHAPES: readonly PinShape[] = ['circle', 'shield', 'hexagon', 'diamond', 'burst'];
const MOTIFS: readonly PinMotif[] = ['rays', 'waves', 'peaks', 'stars', 'rings'];

/** A small, steady hash, so a festival's pin always looks the same. */
export function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** How a festival's pin looks: its shape, motif and colours come from its id, its mark from its name. */
export function pinLook(festival: Pick<Festival, 'id' | 'name' | 'startDate'>): PinLook {
  const h = hashOf(festival.id);
  return {
    shape: SHAPES[h % SHAPES.length],
    motif: MOTIFS[Math.floor(h / 7) % MOTIFS.length],
    enamel: ENAMELS[Math.floor(h / 53) % ENAMELS.length],
    mark: festivalMark(festival.name),
    ...(festival.startDate ? { year: festival.startDate.slice(0, 4) } : {}),
  };
}

/** "Earned Dec 5, 2026 · 3 videos". */
export function earnedLine(b: Badge): string {
  const d = new Date(b.earnedAt);
  const when = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `Earned ${when} · ${b.videos} ${b.videos === 1 ? 'video' : 'videos'}`;
}
