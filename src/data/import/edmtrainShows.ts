/**
 * EDMTrain club shows and concerts -> the catalogue file's "shows" list.
 * Pure: the nightly job (scripts/import-edmtrain.ts) fetches EDMTrain's
 * non-festival events and writes the file, this decides what goes in. The
 * owner asked on 2026-10-05 to see artists' individual shows on their pages.
 *
 * Only artists already on Afterglow (curated, or added by the festival
 * import) get shows: a club night never adds an artist. Each event becomes
 * one show listing the Afterglow artists on its bill, with its EDMTrain page
 * as the link (EDMTrain asks that each event links back to it). Soonest
 * first, so when the caps bite, the farthest shows go.
 */
import { b2bParts } from '../members';
import { type EdmtrainEvent, type EdmtrainVenue, fold } from './edmtrain';

/** One show as written in the catalogue file (read back by parseShow in data/file.ts). */
export type FileShow = {
  id: string;
  date: string;
  name?: string;
  venue: string;
  location?: string;
  place?: { lat: number; lon: number };
  link: string;
  artists: string[];
};

/**
 * Shows within `daysAhead` days, at most `perArtist` for each artist (a show
 * is kept while any of its artists still has room), `maxArtists` Afterglow
 * artists listed per show and `maxShows` in all.
 */
export const SHOW_RULES = { daysAhead: 183, perArtist: 6, maxArtists: 8, maxShows: 1500 } as const;
export type ShowRules = { daysAhead: number; perArtist: number; maxArtists: number; maxShows: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const utc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max).trim() : '');

/** The venue on the map, when EDMTrain gives real coordinates (rounded to about 100 m, like festivals). */
function placeOf(v: EdmtrainVenue): { lat: number; lon: number } | undefined {
  const lat = Number(v.latitude);
  const lon = Number(v.longitude);
  if (v.latitude == null || v.longitude == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return undefined;
  return { lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000 };
}

export type ShowsResult = {
  shows: FileShow[];
  skipped: { notShows: number; outOfRange: number; incomplete: number; noArtists: number; full: number };
};

/**
 * `artists`: everyone on Afterglow (id and name), matched to EDMTrain's acts
 * by name (letters and digits, ignoring accents and capitals). A b2b act
 * ("SUBTRONICS B2B CRANKDAT") that isn't on Afterglow itself counts for each
 * of its artists who is. `today`: "YYYY-MM-DD".
 */
export function edmtrainShows(
  events: readonly EdmtrainEvent[],
  artists: readonly { id: string; name: string }[],
  today: string,
  rules: ShowRules = SHOW_RULES,
): ShowsResult {
  const skipped = { notShows: 0, outOfRange: 0, incomplete: 0, noArtists: 0, full: 0 };
  const byName = new Map<string, string>();
  for (const a of artists) if (!byName.has(fold(a.name))) byName.set(fold(a.name), a.id);
  const idsFor = (name: string): string[] => {
    const whole = byName.get(fold(name));
    if (whole) return [whole];
    return (b2bParts(name) ?? []).flatMap((p) => {
      const id = byName.get(fold(p));
      return id ? [id] : [];
    });
  };

  const seen = new Set<number | string>();
  const candidates: (FileShow & { order: number })[] = [];
  events.forEach((e, order) => {
    if (!e || typeof e !== 'object') return void skipped.incomplete++;
    // Festivals have their own pages; livestreams have no venue to go to.
    if (e.festivalInd || e.livestreamInd) return void skipped.notShows++;
    if (!isDay(e.date)) return void skipped.incomplete++;
    const ahead = Math.round((utc(e.date) - utc(today)) / DAY_MS);
    if (e.date < today || ahead > rules.daysAhead) return void skipped.outOfRange++;
    const venue = clean(e.venue?.name, 80);
    const link = typeof e.link === 'string' && /^https:\/\/[^\s]+$/i.test(e.link) && e.link.length <= 500 ? e.link : undefined;
    if (typeof e.id !== 'number' || !Number.isInteger(e.id) || e.id < 0 || !venue || !link) return void skipped.incomplete++;
    if (seen.has(e.id)) return;
    seen.add(e.id);
    const ids: string[] = [];
    for (const a of e.artistList ?? []) for (const id of idsFor(clean(a?.name, 120))) if (!ids.includes(id)) ids.push(id);
    if (!ids.length) return void skipped.noArtists++;
    const name = clean(e.name, 80);
    const location = clean(e.venue?.location, 80);
    const place = e.venue ? placeOf(e.venue) : undefined;
    candidates.push({
      id: `edm-${e.id}`,
      date: e.date,
      ...(name && fold(name) !== fold(venue) ? { name } : {}),
      venue,
      ...(location ? { location } : {}),
      ...(place ? { place } : {}),
      link,
      artists: ids.slice(0, rules.maxArtists),
      order,
    });
  });

  // Soonest first (EDMTrain's own order within a day), each artist's next few, then the overall cap.
  // The next day of an event already kept (same name and venue: a festival EDMTrain lists as a show a
  // day) is kept too, so a weekend never loses its Sunday to the artists' caps.
  candidates.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const count = new Map<string, number>();
  const shows: FileShow[] = [];
  const runKey = (s: FileShow) => (s.name ? `${fold(s.name)}|${fold(s.venue)}|${fold(s.location ?? '')}` : undefined);
  const keptDays = new Set<string>();
  const dayBefore = (day: string) => new Date(utc(day) - DAY_MS).toISOString().slice(0, 10);
  for (const { order: _order, ...show } of candidates) {
    const key = runKey(show);
    const nextDay = !!key && keptDays.has(`${key}|${dayBefore(show.date)}`);
    if (shows.length >= rules.maxShows || (!nextDay && !show.artists.some((a) => (count.get(a) ?? 0) < rules.perArtist))) {
      skipped.full++;
      continue;
    }
    for (const a of show.artists) count.set(a, (count.get(a) ?? 0) + 1);
    if (key) keptDays.add(`${key}|${show.date}`);
    shows.push(show);
  }
  return { shows, skipped };
}
