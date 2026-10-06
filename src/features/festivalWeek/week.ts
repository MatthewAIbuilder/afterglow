import type { Festival } from '../../data/models';
import { t } from '../../i18n';
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
  // Only before the first run: a two-weekend festival's doors are opened once (pick a weekend to count down to it).
  if (!next || next.index > 0) return undefined;
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

const list = (names: readonly string[]) => (names.length <= 1 ? (names[0] ?? '') : t('{list} and {last}', { list: names.slice(0, -1).join(', '), last: names[names.length - 1] }));

/** One door's surprise, from where your plan is. */
export function doorFor(day: number, f: WeekFacts): Door {
  switch (day) {
    case 7:
      return f.topPicks.length
        ? { day, emoji: '✦', title: t('Your lineup at a glance'), line: t('A week to go. Your must-sees so far: {names}.', { names: list(f.topPicks.slice(0, 3)) }), action: { kind: 'festival', label: t('See your picks') } }
        : { day, emoji: '✦', title: t('A week to go'), line: t('Your plan for {festival} starts with who you love. Rate a few and it fills itself in.', { festival: f.festivalName }), action: { kind: 'tune', label: t('Tune your lineup') } };
    case 6:
      return f.leftToRate > 0
        ? { day, emoji: '♥', title: t('Rate a few more'), line: t('{n} of {total} acts aren’t rated yet. Five minutes now makes your route sharper.', { n: f.leftToRate, total: f.lineup }), action: { kind: 'tune', label: t('Tune your lineup') } }
        : { day, emoji: '♥', title: t('Every act rated'), line: t('You’ve rated the whole lineup. Your plan knows exactly what you love.'), action: { kind: 'festival', label: t('See your plan') } };
    case 5:
      if (f.warmup) return { day, emoji: '▶', title: t('Warm-up playlist'), line: t('{n} live sets from your picks, one after another.', { n: f.warmup.count }), action: { kind: 'warmup', label: t('Play it on YouTube'), url: f.warmup.url } };
      return f.clips
        ? { day, emoji: '▶', title: t('Warm up'), line: t('{n} live clips from the lineup are waiting in Discover.', { n: f.clips }), action: { kind: 'discover', label: t('Watch the lineup') } }
        : { day, emoji: '▶', title: t('Warm up'), line: t('Put your picks on while you get ready. Your must-sees sound even better when you know the drops.'), action: { kind: 'festival', label: t('See your picks') } };
    case 4:
      return f.crew
        ? { day, emoji: '☺', title: t('Check in with the crew'), line: f.crew.people > 1 ? t('Say hi in {crew}’s chat and plan who’s meeting where.', { crew: f.crew.name }) : t('{crew} is just you so far. Invite your friends.', { crew: f.crew.name }), action: f.crew.people > 1 ? { kind: 'chat', label: t('Open the chat'), crewId: f.crew.id } : { kind: 'crew', label: t('Invite friends'), crewId: f.crew.id } }
        : { day, emoji: '☺', title: t('Bring the crew'), line: t('Start a crew: shared picks, one route, a chat, and where everyone is on the day.'), action: { kind: 'start-crew', label: t('Start a crew') } };
    case 3:
      return f.crew?.meetSpot
        ? { day, emoji: '⌖', title: t('Your meeting spot'), line: t('“{spot}”. If you lose each other, that’s where to go.', { spot: f.crew.meetSpot }), action: { kind: 'crew', label: t('See the crew'), crewId: f.crew.id } }
        : f.crew
          ? { day, emoji: '⌖', title: t('Pick a meeting spot'), line: t('Signal drops at festivals. Agree on one spot now, so lost is never really lost.'), action: { kind: 'crew', label: t('Pick it with the crew'), crewId: f.crew.id } }
          : { day, emoji: '⌖', title: t('Know your way'), line: f.onMap ? t('Get a feel for where it is and what’s around it.') : t('Pick a spot to meet your friends if you lose each other: signal drops at festivals.'), action: f.onMap ? { kind: 'map', label: t('Open the map') } : undefined };
    case 2:
      return f.prep.done >= f.prep.total && f.prep.total > 0
        ? { day, emoji: '✓', title: t('Packed and ready'), line: t('Everything on your list is ticked off. Nice.'), action: { kind: 'prep', label: t('See the list') } }
        : { day, emoji: '✓', title: t('Time to pack'), line: t('{n} of {total} done on your list: ID, power bank, earplugs, water bottle…', { n: f.prep.done, total: f.prep.total }), action: { kind: 'prep', label: t('Get ready') } };
    default:
      return f.setTimes
        ? { day, emoji: '★', title: t('Tomorrow!'), line: t('Your route is ready, set to set. It works without signal, so charge up and go.'), action: { kind: 'festival', label: t('See your route') } }
        : { day, emoji: '★', title: t('Tomorrow!'), line: t('Charge everything. Your plan and lineup work without signal, and Tonight opens when it starts.'), action: { kind: 'festival', label: t('See your plan') } };
  }
}

/** "Door 3 is ready", "2 doors to open", "All open", for the card. */
export function weekLine(until: number, opened: ReadonlySet<number>): string {
  const ready = DOORS.filter((d) => isUnlocked(d, until) && !opened.has(d));
  if (until <= 0) return t('It’s today. Have the best time.');
  if (!ready.length) return until === 1 ? t('All doors open. See you tomorrow.') : t('Next door opens tomorrow · {n} days to go', { n: until });
  return ready.length === 1 ? t('Door {n} is ready to open', { n: ready[0] }) : t('{n} doors to open', { n: ready.length });
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
