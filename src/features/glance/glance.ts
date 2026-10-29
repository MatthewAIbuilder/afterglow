import type { Festival } from '../../data/models';
import { stageName } from '../../data/festival';
import { dayStarts } from '../notifications/setReminders';
import type { DayRoute, RouteStop } from '../plan/route';
import { tonightFestival } from '../tonight/tonight';

/**
 * Your festival at a glance, for the places outside the app: the Live
 * Activity (lock screen and Dynamic Island), the widgets and the Apple Watch.
 * Pure: the time is passed in. Times are real clock times (milliseconds), so
 * the widgets and the Watch can count down and move to the next set by
 * themselves, without the app.
 *
 * - `live`: a festival you're going to is on. `sets` is the rest of tonight's
 *   route (the set on now first), from your plan, set times and hours.
 * - `countdown`: the next festival you're going to, within `COUNTDOWN_DAYS`.
 * - `none`: nothing to show.
 */

/** A festival this many days away or closer counts down on the widget. */
export const COUNTDOWN_DAYS = 60;
/** At most this many sets go out (a night's route rarely has more). */
export const GLANCE_SETS_MAX = 16;

export type GlanceSet = {
  artist: string;
  stage: string;
  /** Milliseconds since 1970, local time already applied. */
  start: number;
  end: number;
  /** Minutes of walking from the stage before, when it changes. */
  walk?: number;
  /** The artist's colour ("#RRGGBB"), for a touch of their light. */
  color?: string;
};

export type Glance =
  | { kind: 'none' }
  | { kind: 'countdown'; festivalId: string; festival: string; place: string; startsAt: number }
  | { kind: 'live'; festivalId: string; festival: string; night: string; sets: GlanceSet[]; until: number };

const DAY_MS = 86_400_000;
const minuteMs = (midnight: Date, minute: number) => midnight.getTime() + minute * 60_000;

/** Tonight's sets on the route as clock times, from now on (the one on now included). */
export function tonightSets(festival: Festival, route: DayRoute[], night: string, now: Date): GlanceSet[] {
  const midnight = dayStarts(festival)?.get(night);
  if (!midnight) return [];
  const stops = (route.find((d) => d.day === night)?.stops ?? []).filter((s): s is RouteStop => s.kind === 'set');
  return stops
    .map((s) => ({
      artist: s.artist.name,
      stage: stageName(festival, s.set.stageId),
      start: minuteMs(midnight, s.from),
      end: minuteMs(midnight, s.to),
      ...(s.walk ? { walk: s.walk } : {}),
      ...(s.artist.color ? { color: s.artist.color } : {}),
    }))
    .filter((s) => s.end > now.getTime())
    .slice(0, GLANCE_SETS_MAX);
}

/** Local midnight of a "YYYY-MM-DD". */
const localDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * The glance right now. `routeOf` gives a festival's full-day route (undefined
 * before set times). Pass festivals as they are for you (your weekend).
 */
export function festivalGlance(festivals: readonly Festival[], going: readonly string[], routeOf: (f: Festival) => DayRoute[] | undefined, now: Date): Glance {
  const tonight = tonightFestival(festivals, going, now);
  if (tonight) {
    const f = tonight.festival;
    const night = tonight.night ?? '';
    const route = night ? routeOf(f) : undefined;
    const sets = route ? tonightSets(f, route, night, now) : [];
    const midnight = night ? dayStarts(f)?.get(night) : undefined;
    // The night ends at 7 AM the morning after (set times run past midnight), or with the last set.
    const nightEnd = midnight ? midnight.getTime() + DAY_MS + 7 * 3_600_000 : now.getTime() + 12 * 3_600_000;
    return { kind: 'live', festivalId: f.id, festival: f.name, night, sets, until: Math.max(nightEnd, sets.at(-1)?.end ?? 0) };
  }
  const today = now.getTime();
  const next = festivals
    .filter((f) => going.includes(f.id) && f.startDate)
    .map((f) => ({ f, at: localDay(f.startDate!).getTime() }))
    .filter(({ at }) => at > today && at - today <= COUNTDOWN_DAYS * DAY_MS)
    .sort((a, b) => a.at - b.at)[0];
  if (next) return { kind: 'countdown', festivalId: next.f.id, festival: next.f.name, place: next.f.location, startsAt: next.at };
  return { kind: 'none' };
}

/** The set on now and the one after, from a glance's list (what the Live Activity shows). */
export function nowAndNext(sets: readonly GlanceSet[], now: Date): { now?: GlanceSet; next?: GlanceSet } {
  const t = now.getTime();
  const on = sets.find((s) => s.start <= t && t < s.end);
  const next = sets.find((s) => s.start > t);
  return { ...(on ? { now: on } : {}), ...(next ? { next } : {}) };
}

/** The same glance, give or take the clock: only send it to the phone's widgets when this changes. */
export const glanceKey = (g: Glance) => JSON.stringify(g);

/** What the Live Activity shows right now (dates in milliseconds), and when that goes out of date. */
export type ActivityShow = {
  festival: string;
  night: string;
  state: {
    nowArtist?: string;
    nowStage?: string;
    nowEnd?: number;
    nextArtist?: string;
    nextStage?: string;
    nextStart?: number;
    nextWalk?: number;
    color?: string;
  };
  /** The next moment it changes (the set on now ends, or the next starts). */
  staleAt: number;
};

/**
 * The Live Activity for this glance, or undefined when there shouldn't be one:
 * only on a festival night with sets still to come on your route.
 */
export function activityShow(g: Glance, now: Date): ActivityShow | undefined {
  if (g.kind !== 'live' || !g.sets.length) return undefined;
  const { now: on, next } = nowAndNext(g.sets, now);
  if (!on && !next) return undefined;
  return {
    festival: g.festival,
    night: g.night,
    state: {
      ...(on ? { nowArtist: on.artist, nowStage: on.stage, nowEnd: on.end } : {}),
      ...(on?.color ? { color: on.color } : {}),
      ...(next ? { nextArtist: next.artist, nextStage: next.stage, nextStart: next.start } : {}),
      ...(next?.walk ? { nextWalk: next.walk } : {}),
    },
    staleAt: Math.min(on?.end ?? Infinity, next?.start ?? Infinity),
  };
}
