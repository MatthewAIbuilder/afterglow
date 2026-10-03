import type { Festival } from '../../data/models';
import { nextRun } from '../festivals/when';

/**
 * Festival week: the seven days before a festival you're going to, as an
 * advent calendar. One door opens each day (door 7 a week out, door 1 the
 * day before), each with one small thing that gets you ready, worked out
 * from where your plan is. Pure.
 */

/** How many doors: one for each of the last seven days. */
export const WEEK_DAYS = 7;

/** Where the festival is in its week: days until it starts (your weekend's run), or nothing outside the week. */
export function festivalWeek(festival: Festival, today: Date): { until: number } | undefined {
  const next = nextRun(festival, today);
  if (!next) return undefined;
  if (next.until < 0 || next.until > WEEK_DAYS) return undefined;
  return { until: next.until };
}

/** Door `day` (days to go) is open once there are that many days or fewer left. */
export const isUnlocked = (day: number, until: number) => until <= day;

/** The doors, from a week out to the day before. */
export const DOORS = Array.from({ length: WEEK_DAYS }, (_, i) => WEEK_DAYS - i);

/** What a door can send you to. */
export type DoorAction =
  | { kind: 'festival'; label: string }
  | { kind: 'tune'; label: string }
  | { kind: 'warmup'; label: string; url: string }
  | { kind: 'discover'; label: string }
  | { kind: 'crew'; label: string; crewId: string }
  | { kind: 'chat'; label: string; crewId: string }
  | { kind: 'start-crew'; label: string }
  | { kind: 'prep'; label: string }
  | { kind: 'map'; label: string };

export type Door = { day: number; title: string; line: string; action?: DoorAction; emoji: string };

/** What's known about your plan, for the doors. */
export type WeekFacts = {
  festivalName: string;
  /** Your top picks' names, best first. */
  topPicks: readonly string[];
  /** Lineup acts you haven't rated, and the lineup's size. */
  leftToRate: number;
  lineup: number;
  /** A warm-up playlist, when two or more of your picks have a live set. */
  warmup?: { url: string; count: number };
  /** Clips of the lineup in Discover. */
  clips: number;
  /** Your crew there, if any, with its meeting spot. */
  crew?: { id: string; name: string; people: number; meetSpot?: string };
  /** Get ready's checklist. */
  prep: { done: number; total: number };
  setTimes: boolean;
  /** Has a place, so it's on the festival map. */
  onMap: boolean;
};

const list = (names: readonly string[]) => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** One door's surprise, from where your plan is. */
export function doorFor(day: number, f: WeekFacts): Door {
  switch (day) {
    case 7:
      return f.topPicks.length
        ? { day, emoji: '✦', title: 'Your lineup at a glance', line: `A week to go. Your must-sees so far: ${list(f.topPicks.slice(0, 3))}.`, action: { kind: 'festival', label: 'See your picks' } }
        : { day, emoji: '✦', title: 'A week to go', line: `Your plan for ${f.festivalName} starts with who you love. Rate a few and it fills itself in.`, action: { kind: 'tune', label: 'Tune your lineup' } };
    case 6:
      return f.leftToRate > 0
        ? { day, emoji: '♥', title: 'Rate a few more', line: `${f.leftToRate} of ${f.lineup} acts aren’t rated yet. Five minutes now makes your route sharper.`, action: { kind: 'tune', label: 'Tune your lineup' } }
        : { day, emoji: '♥', title: 'Every act rated', line: 'You’ve rated the whole lineup. Your plan knows exactly what you love.', action: { kind: 'festival', label: 'See your plan' } };
    case 5:
      if (f.warmup) return { day, emoji: '▶', title: 'Warm-up playlist', line: `${f.warmup.count} live sets from your picks, one after another.`, action: { kind: 'warmup', label: 'Play it on YouTube', url: f.warmup.url } };
      return f.clips
        ? { day, emoji: '▶', title: 'Warm up', line: `${f.clips} live clips from the lineup are waiting in Discover.`, action: { kind: 'discover', label: 'Watch the lineup' } }
        : { day, emoji: '▶', title: 'Warm up', line: 'Put your picks on while you get ready. Your must-sees sound even better when you know the drops.', action: { kind: 'festival', label: 'See your picks' } };
    case 4:
      return f.crew
        ? { day, emoji: '☺', title: 'Check in with the crew', line: f.crew.people > 1 ? `Say hi in ${f.crew.name}’s chat and plan who’s meeting where.` : `${f.crew.name} is just you so far. Invite your friends.`, action: f.crew.people > 1 ? { kind: 'chat', label: 'Open the chat', crewId: f.crew.id } : { kind: 'crew', label: 'Invite friends', crewId: f.crew.id } }
        : { day, emoji: '☺', title: 'Bring the crew', line: 'Start a crew: shared picks, one route, a chat, and where everyone is on the day.', action: { kind: 'start-crew', label: 'Start a crew' } };
    case 3:
      return f.crew?.meetSpot
        ? { day, emoji: '⌖', title: 'Your meeting spot', line: `“${f.crew.meetSpot}”. If you lose each other, that’s where to go.`, action: { kind: 'crew', label: 'See the crew', crewId: f.crew.id } }
        : f.crew
          ? { day, emoji: '⌖', title: 'Pick a meeting spot', line: 'Signal drops at festivals. Agree on one spot now, so lost is never really lost.', action: { kind: 'crew', label: 'Pick it with the crew', crewId: f.crew.id } }
          : { day, emoji: '⌖', title: 'Know your way', line: f.onMap ? 'Get a feel for where it is and what’s around it.' : 'Pick a spot to meet your friends if you lose each other: signal drops at festivals.', action: f.onMap ? { kind: 'map', label: 'Open the map' } : undefined };
    case 2:
      return f.prep.done >= f.prep.total && f.prep.total > 0
        ? { day, emoji: '✓', title: 'Packed and ready', line: 'Everything on your list is ticked off. Nice.', action: { kind: 'prep', label: 'See the list' } }
        : { day, emoji: '✓', title: 'Time to pack', line: `${f.prep.done} of ${f.prep.total} done on your list: ID, power bank, earplugs, water bottle…`, action: { kind: 'prep', label: 'Get ready' } };
    default:
      return f.setTimes
        ? { day, emoji: '★', title: 'Tomorrow!', line: 'Your route is ready, set to set. It works without signal, so charge up and go.', action: { kind: 'festival', label: 'See your route' } }
        : { day, emoji: '★', title: 'Tomorrow!', line: 'Charge everything. Your plan and lineup work without signal, and Tonight opens when it starts.', action: { kind: 'festival', label: 'See your plan' } };
  }
}

/** "Door 3 is ready", "2 doors to open", "All open", for the card. */
export function weekLine(until: number, opened: ReadonlySet<number>): string {
  const ready = DOORS.filter((d) => isUnlocked(d, until) && !opened.has(d));
  if (until <= 0) return 'It’s today. Have the best time.';
  if (!ready.length) return until === 1 ? 'All doors open. See you tomorrow.' : `Next door opens tomorrow · ${until} days to go`;
  return ready.length === 1 ? `Door ${ready[0]} is ready to open` : `${ready.length} doors to open`;
}

/** What's stored: festival id -> opened doors. Anything malformed is dropped. */
export function cleanOpened(raw: unknown): Record<string, number[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(raw))
    if (Array.isArray(v)) {
      const days = [...new Set(v.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= WEEK_DAYS))];
      if (days.length) out[k] = days;
    }
  return out;
}
