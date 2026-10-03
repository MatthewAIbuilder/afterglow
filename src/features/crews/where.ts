import type { Festival } from '../../data/models';
import type { Crew, CrewUpdate } from '../social/models';
import { byHappened, isReply, UPDATES_WINDOW_MS } from './updates';

/**
 * Where's the crew, pure: everyone at a festival grouped by the stage their
 * newest update came from. Not GPS: only what people posted, each with when
 * it happened, so an old place is plainly old.
 */

/** An update older than this reads as "a while ago": they've probably moved. */
export const STALE_AFTER_MS = 90 * 60 * 1000;

export type Whereabouts = { uid: string; update: CrewUpdate; stale: boolean };
export type StageGroup = { stage: string; people: Whereabouts[] };
export type CrewWhere = {
  /** Stages with someone last seen there: the festival's stage order, then any other names. */
  stages: StageGroup[];
  /** People whose newest update names no stage. */
  elsewhere: Whereabouts[];
  /** People with no update in the window. */
  quiet: string[];
};

const fold = (s: string) => s.trim().toLowerCase();

/**
 * Everyone in your crews at this festival (once each, never blocked people,
 * you included), placed by their newest non-reply update from the last day
 * and a half. Within a stage, the most recent first.
 */
export function crewWhere(
  festival: Pick<Festival, 'id' | 'stages'>,
  crews: readonly Crew[],
  updates: readonly CrewUpdate[],
  { blocked = [], now }: { blocked?: readonly string[]; now: number },
): CrewWhere {
  const here = crews.filter((c) => c.festivalId === festival.id);
  const people = [...new Set(here.flatMap((c) => c.members))].filter((u) => !blocked.includes(u));
  const inCrew = new Map(here.map((c) => [c.id, new Set(c.members)]));
  const latest = new Map<string, CrewUpdate>();
  for (const u of [...updates].sort(byHappened)) {
    if (isReply(u) || u.care || latest.has(u.uid) || !inCrew.get(u.crewId)?.has(u.uid)) continue;
    if (now - Date.parse(u.at) > UPDATES_WINDOW_MS) continue;
    latest.set(u.uid, u);
  }
  const placed: Whereabouts[] = people
    .filter((p) => latest.has(p))
    .map((uid) => {
      const update = latest.get(uid)!;
      return { uid, update, stale: now - Date.parse(update.at) > STALE_AFTER_MS };
    })
    .sort((a, b) => byHappened(a.update, b.update));

  const order = festival.stages.map((s) => fold(s.name));
  const groups = new Map<string, StageGroup>();
  for (const w of placed) {
    if (!w.update.stage) continue;
    const key = fold(w.update.stage);
    const g = groups.get(key) ?? { stage: festival.stages.find((s) => fold(s.name) === key)?.name ?? w.update.stage, people: [] };
    g.people.push(w);
    groups.set(key, g);
  }
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
  const stages = [...groups.entries()]
    .sort(([a, ga], [b, gb]) => rank(a) - rank(b) || byHappened(ga.people[0].update, gb.people[0].update))
    .map(([, g]) => g);
  return {
    stages,
    elsewhere: placed.filter((w) => !w.update.stage),
    quiet: people.filter((p) => !latest.has(p)),
  };
}

/** "Maya and Sam at Main Stage · 2 of you elsewhere", for screen readers and a one-line summary. */
export function whereLine(where: CrewWhere, nameOf: (uid: string) => string): string {
  const parts = where.stages.map((g) => `${listNames(g.people.map((p) => nameOf(p.uid)))} at ${g.stage}`);
  if (where.elsewhere.length) parts.push(`${listNames(where.elsewhere.map((p) => nameOf(p.uid)))} somewhere else`);
  return parts.length ? parts.join(', ') : 'No one has said where they are yet';
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
