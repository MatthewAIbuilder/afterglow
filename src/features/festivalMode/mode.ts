import type { Festival } from '../../data/models';
import { lineupDays } from '../festivals/days';
import { bySoonest, isOver } from '../festivals/shelves';
import type { Tonight } from '../tonight/tonight';

/**
 * Festival mode, pure: a simpler app while you're at a festival. It asks on
 * the first night of a festival you're going to, then stays on for that
 * festival's nights (until the morning after the last) unless you leave it.
 * A preview lets you try it any time from a festival you're going to.
 */

/** Your answer per festival: switched on, or not now / left. */
export type ModeChoice = 'on' | 'off';
export type ModeSaved = {
  choices: Record<string, ModeChoice>;
  /** Trying it out before the festival: on for this festival until `until`. */
  preview?: { festivalId: string; until: number };
};
export const NO_MODE: ModeSaved = { choices: {} };

/** A test (preview) lasts this long, then the full app comes back by itself. */
export const PREVIEW_MS = 12 * 60 * 60 * 1000;

export type ModeNow = {
  festival: Festival;
  /** Tonight's night ("Saturday"); in a preview, the festival's first day. */
  night?: string;
  preview: boolean;
};

/**
 * Whether festival mode is on and for which festival, and whether to ask.
 * `festivals` as they are for you (your weekend); `tonight` from useTonight.
 */
export function festivalMode(
  saved: ModeSaved,
  tonight: Tonight | undefined,
  festivals: readonly Festival[],
  now: number,
): { active?: ModeNow; ask?: Festival } {
  if (tonight && saved.choices[tonight.festival.id] === 'on') return { active: { festival: tonight.festival, night: tonight.night, preview: false } };
  const p = saved.preview;
  const previewed = p && p.until > now ? festivals.find((f) => f.id === p.festivalId) : undefined;
  if (previewed) return { active: { festival: previewed, night: firstNight(previewed), preview: true } };
  if (tonight && !saved.choices[tonight.festival.id]) return { ask: tonight.festival };
  return {};
}

/** The first day worth planning: the first of the lineup's days, else the festival's. */
export function firstNight(festival: Festival): string | undefined {
  return lineupDays(festival)[0] ?? festival.days[0];
}

export const withChoice = (saved: ModeSaved, festivalId: string, choice: ModeChoice): ModeSaved =>
  saved.choices[festivalId] === choice && !saved.preview ? saved : { choices: { ...saved.choices, [festivalId]: choice } };

export const withPreview = (saved: ModeSaved, festivalId: string, now: number): ModeSaved => ({ ...saved, preview: { festivalId, until: now + PREVIEW_MS } });

/** Leaving: a preview just ends; on a festival night, you've said no to this festival. */
export function leave(saved: ModeSaved, active: ModeNow | undefined): ModeSaved {
  if (!active) return saved;
  if (active.preview) return { choices: saved.choices };
  return { choices: { ...saved.choices, [active.festival.id]: 'off' } };
}

/** What was saved, read back safely (at most 200 festivals remembered; an old preview dropped). */
export function cleanMode(raw: unknown, now: number): ModeSaved {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const choices: Record<string, ModeChoice> = {};
  if (o.choices && typeof o.choices === 'object')
    for (const [k, v] of Object.entries(o.choices as Record<string, unknown>).slice(-200)) if (v === 'on' || v === 'off') choices[k] = v;
  const p = o.preview as { festivalId?: unknown; until?: unknown } | undefined;
  const preview = p && typeof p.festivalId === 'string' && typeof p.until === 'number' && p.until > now ? { festivalId: p.festivalId, until: p.until } : undefined;
  return preview ? { choices, preview } : { choices };
}

/**
 * Which festival "Test festival mode" shows, any day of the year: the
 * soonest festival you're going to that isn't over; else one with set times
 * (so the night shows set to set); else one whose lineup has days; else the
 * soonest coming up. Undefined only with no festivals at all.
 */
export function testFestival(festivals: readonly Festival[], going: readonly string[], today: Date): Festival | undefined {
  const upcoming = bySoonest(festivals.filter((f) => !isOver(f, today)), today);
  return (
    upcoming.find((f) => going.includes(f.id)) ??
    upcoming.find((f) => f.sets?.length) ??
    upcoming.find((f) => lineupDays(f).length) ??
    upcoming[0] ??
    festivals[0]
  );
}
