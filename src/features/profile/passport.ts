import type { Festival } from '../../data/models';
import { cityOf, filmedThere } from '../badges/badges';
import { bySoonest, isOver } from '../festivals/shelves';
import type { Memory } from '../memories/models';

/**
 * Your festival passport: every festival you've been to and every one you're
 * planning, each a stamp with what you brought home. Pure.
 *
 * Been there: a festival you were going to that's over, or one you filmed at
 * on its dates (a video on this phone, or a badge from one you shared).
 */
export type Stamp = {
  festival: Festival;
  /** Videos on this phone tagged there. */
  moments: number;
  /** Artists you filmed there, most filmed first. */
  filmed: string[];
  /** You have its badge (filmed there on its dates). */
  badge: boolean;
  /** Acts on its lineup you'd love (for festivals still to come). */
  loved: number;
};

export type Passport = { been: Stamp[]; planning: Stamp[] };

type Input = {
  /** Every festival, as it is for you (your weekend). */
  festivals: readonly Festival[];
  going: readonly string[];
  memories: readonly Memory[];
  /** Festivals you hold a badge for (from videos you shared). */
  badges: readonly string[];
  loves: (artistId: string) => boolean;
  today: Date;
};

export function passport({ festivals, going, memories, badges, loves, today }: Input): Passport {
  const byId = new Map(festivals.map((f) => [f.id, f]));
  const goingSet = new Set(going);
  const badgeSet = new Set(badges);
  const atFestival = new Map<string, Memory[]>();
  for (const m of memories) if (m.festivalId && byId.has(m.festivalId)) atFestival.set(m.festivalId, [...(atFestival.get(m.festivalId) ?? []), m]);

  const stamp = (f: Festival): Stamp => {
    const mine = atFestival.get(f.id) ?? [];
    const counts = new Map<string, number>();
    for (const m of mine) if (m.artistId) counts.set(m.artistId, (counts.get(m.artistId) ?? 0) + 1);
    return {
      festival: f,
      moments: mine.length,
      filmed: [...counts].sort((a, b) => b[1] - a[1]).map(([id]) => id),
      badge: badgeSet.has(f.id) || mine.some((m) => filmedThere(f, m.capturedAt)),
      loved: f.lineup.filter(loves).length,
    };
  };

  const been: Stamp[] = [];
  const planning: Stamp[] = [];
  for (const f of festivals) {
    const over = isOver(f, today);
    const s = stamp(f);
    if (goingSet.has(f.id) && !over) planning.push(s);
    else if ((goingSet.has(f.id) && over) || s.badge) been.push(s);
  }
  const soonest = bySoonest(planning.map((s) => s.festival), today).map((f) => f.id);
  planning.sort((a, b) => soonest.indexOf(a.festival.id) - soonest.indexOf(b.festival.id));
  // Most recent first.
  been.sort((a, b) => (b.festival.endDate ?? b.festival.startDate ?? '').localeCompare(a.festival.endDate ?? a.festival.startDate ?? ''));
  return { been, planning };
}

/** Different towns among festivals you've been to or are going to. */
export function citiesOf(stamps: readonly Stamp[], more: readonly string[] = []): number {
  return new Set([...stamps.map((s) => cityOf(s.festival.location)?.toLowerCase()), ...more.map((c) => c.toLowerCase())].filter(Boolean)).size;
}

/** "3 moments · 2 artists filmed", "In 2 months · 4 you'd love". */
export function stampLine(s: Stamp, when?: string): string {
  const parts: string[] = [];
  if (when) parts.push(when);
  if (s.moments) parts.push(`${s.moments} ${s.moments === 1 ? 'moment' : 'moments'}`);
  if (s.filmed.length) parts.push(`${s.filmed.length} ${s.filmed.length === 1 ? 'artist' : 'artists'} filmed`);
  else if (s.loved) parts.push(`${s.loved} you’d love`);
  return parts.join(' · ');
}
