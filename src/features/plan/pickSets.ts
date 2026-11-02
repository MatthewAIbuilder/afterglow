import type { Artist, Festival, SetTime } from '../../data/models';
import { toMinutes } from './plan';

/**
 * "Pick sets": every set of one day, in time order, grouped by the hour it
 * starts, so you can go down the day and star who you want to see without
 * any act hiding behind a bigger name. Pure.
 */
export type PickRow = {
  artist: Artist;
  set: SetTime;
  /** Festival-day minutes (after midnight runs past 24:00). */
  start: number;
  end: number;
  match: number;
  known: boolean;
  pinned: boolean;
  /** Other starred acts on at the same time: a clash you've made. */
  clashesWith: Artist[];
};

export type PickHour = { hour: number; rows: PickRow[] };

export function pickHours(
  festival: Festival,
  day: string,
  opts: { artist: (id: string) => Artist | undefined; taste: Record<string, number>; informed: Record<string, boolean>; pinned: ReadonlySet<string>; out?: ReadonlySet<string> },
): PickHour[] {
  const rows: PickRow[] = (festival.sets ?? []).flatMap((set) => {
    if (set.day !== day || opts.out?.has(set.artistId)) return [];
    const artist = opts.artist(set.artistId);
    if (!artist) return [];
    const start = toMinutes(set.start);
    let end = toMinutes(set.end);
    if (end <= start) end += 24 * 60;
    return [{ artist, set, start, end, match: opts.taste[artist.id] ?? 0, known: !!opts.informed[artist.id], pinned: opts.pinned.has(artist.id), clashesWith: [] }];
  });
  for (const r of rows)
    if (r.pinned) r.clashesWith = rows.filter((o) => o !== r && o.pinned && o.artist.id !== r.artist.id && o.start < r.end && r.start < o.end).map((o) => o.artist);
  rows.sort((a, b) => a.start - b.start || Number(b.pinned) - Number(a.pinned) || b.match - a.match);
  const hours: PickHour[] = [];
  for (const r of rows) {
    const hour = Math.floor(r.start / 60);
    const last = hours[hours.length - 1];
    if (last && last.hour === hour) last.rows.push(r);
    else hours.push({ hour, rows: [r] });
  }
  return hours;
}
