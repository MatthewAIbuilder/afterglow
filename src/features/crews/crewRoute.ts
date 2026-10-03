import { stageName } from '../../data/festival';
import type { Artist, Festival, SetTime, TasteProfile } from '../../data/models';
import { formatTime } from '../festivals/format';
import { toMinutes } from '../plan/plan';
import { clockTime, type DayRoute, festivalRoute, type RouteStop } from '../plan/route';
import { cardSection, type CardLine, type PlanCard } from '../plan/share';

/**
 * One route for the whole crew, set to set. Pure.
 *
 * It's your route (your taste, from your phone) pulled towards what the crew
 * starred: each crewmate's star adds `STAR_PULL` to a set's worth (and makes
 * an artist you know nothing about worth a look), and a set starred by at
 * least half the crew (two people or more) becomes a must-see for everyone.
 * Starred sets the route catches less than half of become splits: who heads
 * off, where, and when the set ends so you can meet up again.
 */
export const STAR_PULL = 0.2;
/** Worth of a set the app knows nothing about for you, before the crew's stars. */
const UNKNOWN_BASE = 0.4;

export type CrewSplit = {
  artist: Artist;
  set: SetTime;
  /** Who starred it (member uids, you included when you did). */
  who: string[];
  /** The crew's stop while they're away, if any. */
  during?: Artist;
  /** When the set ends, on the 24-hour clock, to meet up again. */
  backAt: string;
};

export type CrewDay = {
  day: string;
  stops: DayRoute['stops'];
  /** For each set stop, who in the crew starred it. */
  starredBy: Record<string, string[]>;
  splits: CrewSplit[];
};

export type CrewRouteInput = {
  festival: Festival;
  artists: Artist[];
  taste: TasteProfile;
  informed: Record<string, boolean>;
  me: string;
  /** Everyone's stars at this festival, yours included, by member uid. */
  stars: Record<string, readonly string[]>;
  /** Current members (stars from anyone else are ignored). */
  members: readonly string[];
};

/** Who starred each artist, among current members. */
export function starredBy(stars: CrewRouteInput['stars'], members: readonly string[]): Map<string, string[]> {
  const by = new Map<string, string[]>();
  for (const uid of members) for (const a of new Set(stars[uid] ?? [])) by.set(a, [...(by.get(a) ?? []), uid]);
  return by;
}

/** The crew's version of your taste, and the sets everyone should see. */
export function crewTaste(i: CrewRouteInput): { taste: TasteProfile; informed: Record<string, boolean>; pinned: Set<string> } {
  const by = starredBy(i.stars, i.members);
  const taste: TasteProfile = { ...i.taste };
  const informed = { ...i.informed };
  const pinned = new Set<string>();
  const majority = Math.max(2, Math.ceil(i.members.length / 2));
  for (const [artist, who] of by) {
    const others = who.filter((u) => u !== i.me).length;
    const base = informed[artist] ? (taste[artist] ?? 0) : UNKNOWN_BASE;
    taste[artist] = Math.min(1, base + STAR_PULL * others);
    informed[artist] = true;
    if (who.length >= majority) pinned.add(artist);
  }
  return { taste, informed, pinned };
}

const setKey = (s: SetTime) => `${s.artistId}|${s.stageId}|${s.start}`;

export function crewRoute(i: CrewRouteInput): CrewDay[] {
  const { taste, informed, pinned } = crewTaste(i);
  const by = starredBy(i.stars, i.members);
  const route = festivalRoute({ festival: i.festival, artists: i.artists, taste, informed, pinned });
  const artist = new Map(i.artists.map((a) => [a.id, a]));
  return route.map((r) => {
    const stops = r.stops.filter((s): s is RouteStop => s.kind === 'set');
    // Minutes of each set the route spends there.
    const covered = new Map<string, number>();
    for (const s of stops) covered.set(setKey(s.set), (covered.get(setKey(s.set)) ?? 0) + (s.to - s.from));
    const starred: Record<string, string[]> = {};
    for (const s of stops) if (by.has(s.artist.id)) starred[s.artist.id] = by.get(s.artist.id)!;
    const splits: CrewSplit[] = (i.festival.sets ?? [])
      .filter((s) => s.day === r.day && by.has(s.artistId) && artist.has(s.artistId))
      .map((set) => {
        const start = toMinutes(set.start);
        let end = toMinutes(set.end);
        if (end <= start) end += 24 * 60;
        return { set, start, end };
      })
      // A split when the crew catches less than half of it.
      .filter(({ set, start, end }) => (covered.get(setKey(set)) ?? 0) < (end - start) / 2)
      .map(({ set, start, end }) => {
        const during = stops.find((s) => s.set.artistId !== set.artistId && s.from < end && start < s.to);
        return { artist: artist.get(set.artistId)!, set, who: by.get(set.artistId)!, during: during?.artist, backAt: clockTime(end), start };
      })
      .sort((a, b) => a.start - b.start)
      .map(({ start: _start, ...split }) => split);
    return { day: r.day, stops: r.stops, starredBy: starred, splits };
  });
}

/** "Maya", "Maya and Sam", "You and Maya", "Maya, Sam and 2 more". */
export function namesLine(who: readonly string[], me: string, nameOf: (uid: string) => string): string {
  const names = [...(who.includes(me) ? ['You'] : []), ...who.filter((u) => u !== me).map(nameOf)];
  if (names.length <= 2) return names.join(' and ');
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

/**
 * The crew's route as a picture to share: the crew's name, the festival, then
 * each day set to set (a star on must-sees), with who splits off where after
 * the day's sets. Undefined when no day has sets.
 */
export function crewRouteCard(festival: Festival, crewName: string, days: CrewDay[], me: string, nameOf: (uid: string) => string): PlanCard | undefined {
  const sections = days.flatMap((d) => {
    const lines: CardLine[] = [];
    for (const s of d.stops) {
      if (s.kind === 'set') lines.push({ time: formatTime(clockTime(s.from)), name: s.artist.name, where: stageName(festival, s.set.stageId), star: s.pinned });
    }
    for (const s of d.splits) lines.push({ time: formatTime(s.set.start), name: s.artist.name, where: `${namesLine(s.who, me, nameOf)} split off`, star: false });
    return lines.length ? [cardSection(d.day, lines)] : [];
  });
  if (!sections.length) return undefined;
  const subtitle = [`Our route at ${festival.name}`, festival.dates].filter(Boolean).join(' · ');
  return { title: crewName, subtitle, sections };
}
