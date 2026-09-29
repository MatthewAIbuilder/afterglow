import type { Artist, Festival, SetTime, TasteProfile } from '../../data/types';
import { toMinutes } from './plan';

/**
 * Your whole day, set to set. Pure.
 *
 * Where the timetable shows your picks (and clashes between them), the route
 * answers "where should I be?" for every minute from the first set to the
 * last: it follows your must-sees and best matches, fills the gaps with the
 * best of the rest, and says when to leave one set to catch another.
 *
 * How: the day is cut into slices wherever a set starts or ends. Each set is
 * worth your match per minute (a must-see is worth far more; an artist the app
 * knows nothing about gets a modest "discovery" value; artists you don't like
 * are worth nothing, so a break beats them). Changing stages costs a little,
 * so it doesn't hop every few minutes. The best path through the slices is
 * found exactly (dynamic programming), then tidied: stints too short to be
 * worth the walk are folded into their neighbours.
 */

/** Value per minute of an artist the app has no signal for: worth a look, not worth leaving a match for. */
export const DISCOVERY_VALUE = 0.3;
/** A must-see is worth this much per minute, so the route never skips one it can reach. */
export const MUST_SEE_VALUE = 3;
/** Below this match a set isn't worth your time; a break is suggested instead. */
export const MIN_VALUE = 0.15;
/** Cost of walking from one set to another, in minutes at a perfect match. */
export const SWITCH_COST = 12;
/** Shortest stint the route suggests (unless it's all that's left of the day). */
export const MIN_STINT = 15;

export type RouteStop = {
  kind: 'set';
  artist: Artist;
  set: SetTime;
  /** Minutes, on the festival-day clock (`toMinutes`: after midnight runs past 24:00). */
  from: number;
  to: number;
  /** The set's own start and end, on the same clock. */
  setStart: number;
  setEnd: number;
  match: number;
  pinned: boolean;
  /** The app has real signal for this artist; otherwise it's a discovery. */
  known: boolean;
};

export type RouteBreak = { kind: 'break'; from: number; to: number };

export type DayRoute = { day: string; stops: (RouteStop | RouteBreak)[] };

export type RouteInput = {
  festival: Festival;
  artists: Artist[];
  taste: TasteProfile;
  informed: Record<string, boolean>;
  /** Your must-sees at this festival. */
  pinned?: ReadonlySet<string>;
};

type Timed = { set: SetTime; artist: Artist; start: number; end: number; value: number; match: number; known: boolean; pinned: boolean; rank: number };

function timedSets(input: RouteInput, day: string): Timed[] {
  const { festival, artists, taste, informed, pinned } = input;
  const byId = new Map(artists.map((a) => [a.id, a]));
  const billing = new Map(festival.lineup.map((id, i) => [id, i]));
  return (festival.sets ?? []).flatMap((set) => {
    if (set.day !== day) return [];
    const artist = byId.get(set.artistId);
    if (!artist) return [];
    const start = toMinutes(set.start);
    let end = toMinutes(set.end);
    if (end <= start) end += 24 * 60;
    const match = taste[artist.id] ?? 0;
    const known = !!informed[artist.id];
    const isPinned = !!pinned?.has(artist.id);
    const value = isPinned ? MUST_SEE_VALUE : known ? match : Math.max(match, DISCOVERY_VALUE);
    return [{ set, artist, start, end, value, match, known, pinned: isPinned, rank: billing.get(artist.id) ?? 9999 }];
  });
}

/** The best path through one day. Empty when the day has no sets. */
export function dayRoute(input: RouteInput, day: string): DayRoute {
  const sets = timedSets(input, day).filter((s) => s.pinned || s.value >= MIN_VALUE);
  if (!sets.length) return { day, stops: [] };

  // Slices between every start and end.
  const cuts = [...new Set(sets.flatMap((s) => [s.start, s.end]))].sort((a, b) => a - b);
  const slices = cuts.slice(0, -1).map((from, i) => ({
    from,
    to: cuts[i + 1],
    // Who's on for the whole slice; -1 is a break.
    on: [-1, ...sets.flatMap((s, j) => (s.start <= from && s.end >= cuts[i + 1] ? [j] : []))],
  }));

  // Best score ending each slice in each state, and how we got there.
  const score: Map<number, number>[] = [];
  const back: Map<number, number>[] = [];
  slices.forEach((slice, i) => {
    const len = slice.to - slice.from;
    const here = new Map<number, number>();
    const from = new Map<number, number>();
    for (const state of slice.on) {
      const gain = state < 0 ? 0 : sets[state].value * len;
      if (i === 0) {
        here.set(state, gain);
        from.set(state, -1);
        continue;
      }
      let best = -Infinity;
      let arg = -1;
      for (const [prev, s] of score[i - 1]) {
        // Staying put is free; walking from one set to another costs a little. Ties keep what you're at.
        const cost = prev >= 0 && state >= 0 && prev !== state ? SWITCH_COST : 0;
        const total = s - cost + (prev === state ? 1e-6 : 0);
        if (total > best || (total === best && betterTie(prev, arg, sets))) {
          best = total;
          arg = prev;
        }
      }
      here.set(state, best + gain);
      from.set(state, arg);
    }
    score.push(here);
    back.push(from);
  });

  // Walk back from the best finish.
  let state = [...score[score.length - 1].entries()].reduce((a, b) => (b[1] > a[1] || (b[1] === a[1] && betterTie(b[0], a[0], sets)) ? b : a))[0];
  const path: number[] = [];
  for (let i = slices.length - 1; i >= 0; i--) {
    path.unshift(state);
    state = back[i].get(state) ?? -1;
  }

  // Runs of the same state become stops.
  let stops: (RouteStop | RouteBreak)[] = [];
  path.forEach((st, i) => {
    const { from, to } = slices[i];
    const last = stops[stops.length - 1];
    const same = last && (st < 0 ? last.kind === 'break' : last.kind === 'set' && last.set === sets[st].set);
    if (same && last.to === from) {
      last.to = to;
      return;
    }
    stops.push(st < 0 ? { kind: 'break', from, to } : stopFor(sets[st], from, to));
  });
  stops = tidy(stops);
  return { day, stops };
}

/** Every day of the festival, in order. */
export function festivalRoute(input: RouteInput): DayRoute[] {
  return input.festival.days.map((day) => dayRoute(input, day));
}

const stopFor = (s: Timed, from: number, to: number): RouteStop => ({
  kind: 'set',
  artist: s.artist,
  set: s.set,
  from,
  to,
  setStart: s.start,
  setEnd: s.end,
  match: s.match,
  pinned: s.pinned,
  known: s.known,
});

/** On an exact tie: stay with a set over a break, then the higher value, then the higher billing. */
function betterTie(a: number, b: number, sets: Timed[]) {
  if (b < 0) return a >= 0;
  if (a < 0) return false;
  return sets[a].value > sets[b].value || (sets[a].value === sets[b].value && sets[a].rank < sets[b].rank);
}

/**
 * Folds stints too short to be worth the walk into a neighbour that is still
 * playing (or a break), and drops breaks at the very start and end of the day.
 */
function tidy(stops: (RouteStop | RouteBreak)[]): (RouteStop | RouteBreak)[] {
  const out = [...stops];
  for (let i = 0; i < out.length; i++) {
    const s = out[i];
    if (s.kind !== 'set' || s.pinned || s.to - s.from >= MIN_STINT) continue;
    if (out.length === 1) break;
    const prev = out[i - 1];
    const next = out[i + 1];
    // Stay longer at the set before, if it's still on; otherwise arrive earlier at the next.
    if (prev?.kind === 'set' && prev.setEnd >= s.to) prev.to = s.to;
    else if (next?.kind === 'set' && next.setStart <= s.from) next.from = s.from;
    else out[i] = { kind: 'break', from: s.from, to: s.to };
    if (out[i] === s) out.splice(i, 1);
    i = Math.max(-1, i - 2);
  }
  // Neighbouring breaks become one; no break before the first set or after the last.
  const merged: (RouteStop | RouteBreak)[] = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (s.kind === 'break' && last?.kind === 'break') last.to = s.to;
    else merged.push(s);
  }
  while (merged[0]?.kind === 'break') merged.shift();
  while (merged[merged.length - 1]?.kind === 'break') merged.pop();
  return merged;
}

/** Minutes on the festival clock -> "23:40" (after midnight wraps back round). */
export function clockTime(min: number) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** How much of the set a stop covers, in words: "Whole set", "First 45 min", "Last 30 min", "40 min". */
export function stintLabel(stop: RouteStop) {
  const whole = stop.from <= stop.setStart && stop.to >= stop.setEnd;
  if (whole) return 'Whole set';
  const min = stop.to - stop.from;
  if (stop.from <= stop.setStart) return `First ${min} min`;
  if (stop.to >= stop.setEnd) return `Last ${min} min`;
  return `${min} min`;
}
