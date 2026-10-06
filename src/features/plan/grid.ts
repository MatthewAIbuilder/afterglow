import type { Artist, Festival, SetTime, TasteProfile } from '../../data/types';
import { LANGUAGE } from '../../i18n';
import { TIER_AT, toMinutes } from './plan';
import type { DayRoute } from './route';

/**
 * The classic festival timetable: one column per stage, time running down,
 * every set as a block. Pure: this lays out a day on the festival clock
 * (minutes, after-midnight past 24:00); the screen turns minutes into points.
 */
export type GridBlock = {
  artist: Artist;
  set: SetTime;
  /** Which column (stage) it sits in. */
  column: number;
  start: number;
  end: number;
  match: number;
  /** The app has real signal for this artist. */
  known: boolean;
  /** Your must-see here. */
  pinned: boolean;
  /** Your full-day route is here for some of it. */
  onRoute: boolean;
  /** How it looks: glowing for must-sees and strong matches, quiet for the rest, dashed when new to you. */
  tone: 'must' | 'strong' | 'some' | 'new' | 'low';
};

export type GridDay = {
  day: string;
  stages: { id: string; name: string }[];
  /** Whole hours bounding the day. */
  from: number;
  to: number;
  /** Hour lines inside it, on the same clock. */
  hours: number[];
  blocks: GridBlock[];
};

const HOUR = 60;

export function gridDay(
  festival: Festival,
  day: string,
  input: { artist: (id: string) => Artist | undefined; taste: TasteProfile; informed: Record<string, boolean>; pinned: ReadonlySet<string>; route?: DayRoute },
): GridDay | undefined {
  const sets = (festival.sets ?? []).filter((s) => s.day === day && input.artist(s.artistId));
  if (!sets.length) return undefined;
  // Stages in the festival's order, only those with a set today.
  const used = new Set(sets.map((s) => s.stageId));
  const stages = festival.stages.filter((s) => used.has(s.id));
  for (const id of used) if (!stages.some((s) => s.id === id)) stages.push({ id, name: id });
  const column = new Map(stages.map((s, i) => [s.id, i]));
  const onRoute = new Set(
    (input.route?.stops ?? []).flatMap((s) => (s.kind === 'set' ? [`${s.set.artistId}|${s.set.stageId}|${s.set.start}`] : [])),
  );

  const blocks = sets.map((set): GridBlock => {
    const artist = input.artist(set.artistId)!;
    const start = toMinutes(set.start);
    let end = toMinutes(set.end);
    if (end <= start) end += 24 * HOUR;
    const known = !!input.informed[artist.id];
    const match = input.taste[artist.id] ?? 0;
    const pinned = input.pinned.has(artist.id);
    const tone = pinned ? 'must' : !known ? 'new' : match >= TIER_AT.strong ? 'strong' : match >= TIER_AT.explore ? 'some' : 'low';
    return {
      artist,
      set,
      column: column.get(set.stageId)!,
      start,
      end,
      match,
      known,
      pinned,
      onRoute: onRoute.has(`${set.artistId}|${set.stageId}|${set.start}`),
      tone,
    };
  });
  blocks.sort((a, b) => a.start - b.start || a.column - b.column);
  const from = Math.floor(Math.min(...blocks.map((b) => b.start)) / HOUR) * HOUR;
  const to = Math.ceil(Math.max(...blocks.map((b) => b.end)) / HOUR) * HOUR;
  const hours: number[] = [];
  for (let h = from; h <= to; h += HOUR) hours.push(h);
  return { day, stages, from, to, hours, blocks };
}

/** "10 PM", "12 AM", "1 AM" for an hour on the festival clock ("22:00", "0:00" on the 24-hour clock in Spanish). */
export function hourLabel(min: number): string {
  const h = Math.floor(min / HOUR) % 24;
  if (LANGUAGE === 'es') return `${h}:00`;
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${h < 12 ? 'AM' : 'PM'}`;
}
