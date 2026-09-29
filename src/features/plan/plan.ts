import type { Artist, Festival, SetTime, SoundTag, TasteProfile } from '../../data/types';
import { type Similarity, soundSimilarity } from '../taste/similarity';

/**
 * Personal festival plan. Pure, so it is easy to test and later to move
 * server-side.
 *
 * Everything here reads the live match from the taste engine; nothing writes
 * back to it. A manual must-see is a planning preference only: it moves an
 * artist up your plan and wins clashes, but never changes their match.
 *
 * Two phases:
 * - Before set times: the lineup ranked into must-see, strong match and explore.
 * - After set times: the same picks laid out day by day, with clashes grouped
 *   and a suggestion for each one.
 */

/** Match thresholds for each tier. Artists below EXPLORE are left out of the plan. */
export const TIER_AT = { mustSee: 0.9, strong: 0.75, explore: 0.35 } as const;
/** Two matches closer than this are a genuine choice, not a clear winner. */
export const CLOSE_CALL = 0.05;
/** Similarity needed to call one artist's sound "close to" another's. */
const NEAR_SOUND = 0.3;
/** Shortest part of a clashing set worth suggesting you catch. */
const MIN_CATCH = 20;
/** Times before noon belong to the night before. */
const DAY_BREAK = 12 * 60;

export type Tier = 'must-see' | 'strong' | 'explore';

export type Pick = {
  artist: Artist;
  /** Live match from the taste engine, untouched by manual must-sees. */
  match: number;
  tier: Tier;
  /** You marked this artist as a must-see. */
  pinned: boolean;
  /** False when we have no real signal for this artist yet, so the match is a guess. */
  known: boolean;
  set?: SetTime;
};

/** Why an exploratory pick is worth a look. */
export type ExploreReason =
  | { kind: 'unknown' }
  | { kind: 'near'; to: Artist }
  | { kind: 'new-sound'; sound?: SoundTag };

export type PlanInput = {
  festival: Festival;
  artists: Artist[];
  taste: TasteProfile;
  /** Manual must-sees. */
  pinned?: ReadonlySet<string>;
  /** Which artists the taste engine actually has signal for. Defaults to anyone with a score. */
  informed?: Record<string, boolean>;
};

const TIER_ORDER: Record<Tier, number> = { 'must-see': 0, strong: 1, explore: 2 };

function tierFor(match: number, known: boolean, pinned: boolean): Tier | null {
  if (pinned) return 'must-see';
  // Without real signal a high number would be pretending; treat it as a chance to explore.
  if (!known) return 'explore';
  if (match >= TIER_AT.mustSee) return 'must-see';
  if (match >= TIER_AT.strong) return 'strong';
  if (match >= TIER_AT.explore) return 'explore';
  return null;
}

/** The lineup as your ranked plan: must-sees first, then strong matches, then things to explore. */
export function rankLineup({ festival, artists, taste, pinned, informed }: PlanInput): Pick[] {
  const byId = new Map(artists.map((a) => [a.id, a]));
  const picks: Pick[] = [];
  for (const id of festival.lineup) {
    const artist = byId.get(id);
    if (!artist) continue;
    const match = taste[id] ?? 0;
    const known = informed ? !!informed[id] : id in taste;
    const isPinned = !!pinned?.has(id);
    const tier = tierFor(match, known, isPinned);
    if (!tier) continue;
    picks.push({ artist, match, tier, pinned: isPinned, known, set: festival.sets?.find((s) => s.artistId === id) });
  }
  return picks.sort(
    (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || Number(b.known) - Number(a.known) || b.match - a.match,
  );
}

/** Why an explore pick is interesting, relative to the artists you already love. */
export function exploreReason(pick: Pick, picks: Pick[], similarity: Similarity = soundSimilarity): ExploreReason {
  if (!pick.known) return { kind: 'unknown' };
  let best: { to: Artist; s: number } | null = null;
  for (const p of picks) {
    if (p.tier === 'explore' || p.artist.id === pick.artist.id) continue;
    const s = similarity(pick.artist, p.artist);
    if (s >= NEAR_SOUND && (!best || s > best.s)) best = { to: p.artist, s };
  }
  if (best) return { kind: 'near', to: best.to };
  const lead = (Object.entries(pick.artist.sound) as [SoundTag, number][]).sort((a, b) => b[1] - a[1])[0];
  return { kind: 'new-sound', sound: lead?.[0] };
}

// ---------------------------------------------------------------------------
// After set times

/** "23:40" -> minutes since the festival day began; after-midnight times land past 24:00. */
export function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  const min = h * 60 + m;
  return min < DAY_BREAK ? min + 24 * 60 : min;
}

export type TimedPick = Pick & { set: SetTime; start: number; end: number };

const timed = (p: Pick & { set: SetTime }): TimedPick => {
  const start = toMinutes(p.set.start);
  let end = toMinutes(p.set.end);
  if (end <= start) end += 24 * 60;
  return { ...p, start, end };
};

const overlaps = (a: TimedPick, b: TimedPick) => a.start < b.end && b.start < a.end;

/** Part of a clashing set you could still catch around the one you pick. */
export type Catch = { pick: TimedPick; minutes: number; when: 'before' | 'after' };

export type ClashVerdict =
  /** You marked one of them; that is the plan. */
  | { kind: 'pinned'; pick: TimedPick; other: TimedPick; catch?: Catch }
  /** One is clearly the better match. `lead` is the gap in match, 0 to 1. */
  | { kind: 'clear'; pick: TimedPick; other: TimedPick; lead: number; catch?: Catch }
  /** Too close to call: a genuine choice. */
  | { kind: 'close'; a: TimedPick; b: TimedPick; catch?: Catch };

export type ScheduleItem =
  | { kind: 'set'; start: number; pick: TimedPick; alternatives: TimedPick[] }
  | { kind: 'clash'; start: number; picks: TimedPick[]; verdict: ClashVerdict; alternatives: TimedPick[] }
  /** An explore pick in a window where nothing on your list is playing. */
  | { kind: 'discover'; start: number; pick: TimedPick; reason: ExploreReason };

export type ScheduleDay = { day: string; items: ScheduleItem[]; clashes: number };

export type Schedule = {
  days: ScheduleDay[];
  /** Picks on the lineup who have no set time yet. */
  unscheduled: Pick[];
};

/** Most important first: your must-sees, then the stronger match. */
const priority = (a: Pick, b: Pick) => Number(b.pinned) - Number(a.pinned) || b.match - a.match;

function catchable(keep: TimedPick, miss: TimedPick): Catch | undefined {
  const before = Math.max(0, Math.min(miss.end, keep.start) - miss.start);
  const after = Math.max(0, miss.end - Math.max(miss.start, keep.end));
  if (Math.max(before, after) < MIN_CATCH) return undefined;
  return before >= after
    ? { pick: miss, minutes: before, when: 'before' }
    : { pick: miss, minutes: after, when: 'after' };
}

/** How to call a clash. `ranked` is most important first. */
export function judgeClash(ranked: TimedPick[]): ClashVerdict {
  const [top, next] = ranked;
  if (top.pinned && !next.pinned) return { kind: 'pinned', pick: top, other: next, catch: catchable(top, next) };
  const lead = top.match - next.match;
  if (lead < CLOSE_CALL) return { kind: 'close', a: top, b: next, catch: catchable(top, next) };
  return { kind: 'clear', pick: top, other: next, lead, catch: catchable(top, next) };
}

/** Groups sets that overlap each other, directly or through a chain. */
function overlapGroups(sets: TimedPick[]): TimedPick[][] {
  const groups: TimedPick[][] = [];
  let reach = -Infinity;
  for (const s of [...sets].sort((a, b) => a.start - b.start)) {
    if (s.start < reach) groups[groups.length - 1].push(s);
    else groups.push([s]);
    reach = Math.max(reach, s.end);
  }
  return groups;
}

/**
 * Your picks laid out day by day. Must-sees and strong matches form the plan
 * and clashes between them are grouped and judged. Explore picks show up as
 * discoveries when you are free, or as a quiet alternative when they overlap
 * something already on your plan.
 */
export function buildSchedule(festival: Festival, picks: Pick[]): Schedule {
  const withSet = picks.filter((p): p is Pick & { set: SetTime } => !!p.set).map(timed);
  const unscheduled = picks.filter((p) => !p.set);

  const days = festival.days.map((day): ScheduleDay => {
    const today = withSet.filter((p) => p.set.day === day);
    const planned = today.filter((p) => p.tier !== 'explore');
    const explore = today.filter((p) => p.tier === 'explore');

    const items: ScheduleItem[] = overlapGroups(planned).map((group) => {
      const start = Math.min(...group.map((p) => p.start));
      if (group.length === 1) return { kind: 'set', start, pick: group[0], alternatives: [] };
      const ranked = [...group].sort(priority);
      return { kind: 'clash', start, picks: ranked, verdict: judgeClash(ranked), alternatives: [] };
    });

    for (const e of explore) {
      const host = items.find(
        (i) => i.kind !== 'discover' && (i.kind === 'set' ? [i.pick] : i.picks).some((p) => overlaps(p, e)),
      );
      if (host && host.kind !== 'discover') host.alternatives.push(e);
      else items.push({ kind: 'discover', start: e.start, pick: e, reason: exploreReason(e, picks) });
    }

    items.sort((a, b) => a.start - b.start);
    return { day, items, clashes: items.filter((i) => i.kind === 'clash').length };
  });

  return { days, unscheduled };
}
