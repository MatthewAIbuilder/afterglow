import type { Artist, ArtistSimilarity, CatalogSnapshot, Clip, Festival, FestivalLineup, SetTime, Show, SoundCloudProfile, SoundTag, Stage, YouTubeClipSource } from './models';
import { SOUND_TAGS } from './models';
import { soundcloudProfile, soundcloudUrl } from './import/soundcloud';

/**
 * The catalogue file: how real festivals, artists and clips get into the app
 * without touching code. A plain JSON file, written to be filled in by hand
 * (see docs/catalogue.md), either bundled with the app or hosted anywhere as
 * a static file (CATALOG_URL in config/data.ts).
 *
 * It is friendlier than the app's own models: a YouTube link instead of a
 * video id, "25:00" instead of 1500 seconds, `artist` instead of `artistId`.
 * parseCatalogFile turns it into a CatalogSnapshot and explains, in plain
 * words, anything it had to leave out. It never throws; a file it can't use at
 * all comes back with `snapshot: undefined`.
 *
 * Format version 1:
 * {
 *   "version": 1,
 *   "mode": "add",                      // "add" to the demo data, or "replace" it
 *   "artists":   [{ "id", "name", "sound": { "house": 1 }, "image"?, "soundcloud"?: "https://soundcloud.com/…" }],
 *   "festivals": [{ "id", "name", "dates", "location", "start"?: "2026-11-06", "end"?: "2026-11-08",
 *                   "lineup": [artist ids, or { "artist", "note": "Sunset set", "days": ["Friday"], "weekend": 1 }],
 *                   "weekends"?: [{ "start", "end" }, ...],   // festivals run over separate weekends
 *                   "days"?, "stages"?: [{ "id", "name" }], "poster"?, "tickets"?, "ticketsPartner"?, "stay"?, "website"?,
 *                   "sets"?: [{ "artist", "day", "stage", "start": "23:40", "end": "01:10" }] }],
 *   "clips":     [{ "id", "artist", "festival", "title",
 *                   "video"?: { "link", "from": "25:00", "to": "25:45", "channel" },
 *                   "seconds"?, "bpm"? }],
 *   "similar"?:  [{ "artist", "other", "score": 0.8 }],
 *   "shows"?:    [{ "id", "date": "2026-10-18", "name"?, "venue", "location"?, "place"?, "link": "https://edmtrain.com/…",
 *                   "artists": [artist ids] }]   // club shows from the nightly EDMTrain feed
 *   "soundcloud"?: { "artist-id": { "url": "https://soundcloud.com/…", "name"?, "image"? } }
 *                                     // SoundCloud pages matched each night (an artist's own "soundcloud" wins)
 * }
 *
 * An update published from HQ may write a festival already on Afterglow
 * with only what it changes: its id, name and dates, then any of "lineup",
 * "days", "stages", "sets", "website" or "tickets" (each replacing that part
 * whole), and "add": { "lineup"?, "days"?, "stages"?, "sets"? } (joined to
 * what the festival has; a set replaces that act's set that day). Anything
 * left out keeps the catalogue's own (`festivalParts`, `asPatch` in merge.ts).
 */

export const FILE_VERSION = 1;

export type FileMode = 'add' | 'replace';

export type ParsedFile = {
  /** What the file adds up to, or undefined if it can't be used at all. */
  snapshot?: CatalogSnapshot;
  mode: FileMode;
  /** When the file says it was last updated, if it does. */
  updated?: string;
  /** Plain-language notes on everything left out. Empty when the file is perfect. */
  problems: string[];
  /** Artist id -> photo link, for artists without their own imageUrl (filled in by the nightly photo job). */
  photos?: Record<string, string>;
  /** Where those photos are from ("Deezer"), credited on artist pages. */
  photoCredit?: string;
  /** Festival id -> the picture its official site shares (filled in by the nightly site pictures job). */
  sitePictures?: Record<string, string>;
  /** Artist name -> photo link, for the artists in a b2b who aren't on Afterglow themselves (filled in by the nightly photo job). */
  memberPhotos?: Record<string, string>;
  /** Artist id -> colour ("#8E6BFF") taken from their photo (filled in by the nightly colour job). */
  colors?: Record<string, string>;
  /** YouTube videos never to show (wrong artist, not a set), by video id: their clips are left out wherever they come from. */
  blockedVideos?: string[];
  /**
   * Festival id -> what an update wrote for it, when the file writes a festival only in part (without
   * its "lineup", "days" or "stages") or adds to one ("add"). Absent for a file of whole festivals.
   */
  festivalParts?: Record<string, FestivalParts>;
};

/** The parts of a festival an update may write, each replacing the catalogue's whole. */
export const FESTIVAL_PARTS = ['lineup', 'days', 'stages', 'sets', 'website', 'tickets'] as const;
export type FestivalPart = (typeof FESTIVAL_PARTS)[number];
/** Which parts an update wrote for a festival, and what it adds (its lineup, days, stages and sets). */
export type FestivalParts = { given: FestivalPart[]; add?: Pick<Festival, 'lineup' | 'days' | 'stages' | 'sets' | 'notes' | 'artistDays' | 'artistWeekends'> };

const ID = /^[A-Za-z0-9_.-]{1,64}$/;
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const MAX_TEXT = 120;
/** Placeholder light show tempo when a clip doesn't say. */
const DEFAULT_BPM = 128;
/** Longest clip section we accept, so a typo can't make a two-hour "clip". */
const MAX_CLIP_SEC = 180;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown) => (typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_TEXT ? v.trim() : undefined);
const id = (v: unknown) => (typeof v === 'string' && ID.test(v) ? v : undefined);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const label = (v: unknown, fallback: string) => (typeof v === 'string' && v ? `"${v.slice(0, 40)}"` : fallback);

/** Only secure web links for images. */
export function safeImageUrl(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > 2000) return undefined;
  return /^https:\/\/[^\s]+$/i.test(v) ? v : undefined;
}

/** "2026-11-06" if it's a real calendar day, otherwise undefined. */
export function isoDay(v: unknown): string | undefined {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? v : undefined;
}

/** "25:00", "1:02:30", "1500" or 1500 -> seconds. */
export function parseSeconds(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const parts = v.trim().split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return undefined;
  return parts.reduce((sum, p) => sum * 60 + Number(p), 0);
}

/**
 * The video id in a YouTube link, and whether it's a Short (vertical). Accepts
 * watch links, youtu.be links, Shorts, live and embed links, or a bare id.
 */
export function parseYouTubeLink(v: unknown): { videoId: string; vertical: boolean } | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return { videoId: s, vertical: false };
  const m =
    s.match(/^https?:\/\/(?:www\.|m\.|music\.)?youtube\.com\/watch\?(?:.*&)?v=([A-Za-z0-9_-]{11})(?:[&#].*)?$/) ??
    s.match(/^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{11})(?:[?#].*)?$/) ??
    s.match(/^https?:\/\/(?:www\.|m\.)?youtube\.com\/(shorts|live|embed)\/([A-Za-z0-9_-]{11})(?:[?#].*)?$/);
  if (!m) return undefined;
  if (m.length === 3) return { videoId: m[2], vertical: m[1] === 'shorts' };
  return { videoId: m[1], vertical: false };
}

function parseArtist(raw: unknown, i: number, problems: string[]): Artist | undefined {
  const where = `Artist ${i + 1}`;
  if (!isObj(raw)) return void problems.push(`${where} isn't written as { ... }, so it was left out.`);
  const artistId = id(raw.id);
  const name = text(raw.name);
  if (!artistId) return void problems.push(`${where} ${label(raw.name, '')} needs an id made of letters, numbers and dashes.`);
  if (!name) return void problems.push(`Artist "${artistId}" needs a name.`);
  const sound: Partial<Record<SoundTag, number>> = {};
  if (isObj(raw.sound)) {
    for (const [tag, w] of Object.entries(raw.sound)) {
      if ((SOUND_TAGS as readonly string[]).includes(tag) && typeof w === 'number' && w >= 0 && w <= 1) sound[tag as SoundTag] = w;
      else problems.push(`Artist "${artistId}": sound "${tag}" was ignored (use one of ${SOUND_TAGS.join(', ')}, with a number from 0 to 1).`);
    }
  }
  // No sound is fine: the artist shows as new to you until you react to their clips.
  const artist: Artist = { id: artistId, name, sound };
  if (raw.image !== undefined) {
    const imageUrl = safeImageUrl(raw.image);
    if (imageUrl) artist.imageUrl = imageUrl;
    else problems.push(`Artist "${artistId}": the image link must start with https://, so it was ignored.`);
  }
  if (raw.soundcloud !== undefined) {
    const page = soundcloudUrl(raw.soundcloud);
    if (page) artist.soundcloud = page;
    else problems.push(`Artist "${artistId}": the SoundCloud link should look like https://soundcloud.com/their-name, so it was ignored.`);
  }
  return artist;
}

function parseFestival(raw: unknown, i: number, problems: string[]): Festival | undefined {
  const where = `Festival ${i + 1}`;
  if (!isObj(raw)) return void problems.push(`${where} isn't written as { ... }, so it was left out.`);
  const festivalId = id(raw.id);
  if (!festivalId) return void problems.push(`${where} ${label(raw.name, '')} needs an id made of letters, numbers and dashes.`);
  const name = text(raw.name);
  const dates = text(raw.dates);
  const location = text(raw.location) ?? '';
  if (!name || !dates) return void problems.push(`Festival "${festivalId}" needs a name and dates.`);

  // A lineup entry is an artist id, or { "artist", "note" } for a set the poster says something about.
  const notes: Record<string, string> = {};
  const artistDays: Record<string, string[]> = {};
  const artistWeekends: Record<string, number> = {};
  const lineup = list(raw.lineup).flatMap((a) => {
    const artistId = id(isObj(a) ? a.artist : a);
    if (!artistId) {
      problems.push(`Festival "${festivalId}": a lineup entry isn't an artist id, so it was left out.`);
      return [];
    }
    if (isObj(a) && a.note !== undefined) {
      const note = text(a.note);
      if (note) notes[artistId] = note;
      else problems.push(`Festival "${festivalId}": the note for "${artistId}" should be a short line of text.`);
    }
    // Only one weekend of a festival run over several.
    if (isObj(a) && a.weekend !== undefined) {
      if (typeof a.weekend === 'number' && Number.isInteger(a.weekend) && a.weekend >= 1) artistWeekends[artistId] = a.weekend;
      else problems.push(`Festival "${festivalId}": the weekend for "${artistId}" should be a number like 1.`);
    }
    // The day(s) the poster lists them under, before set times are out.
    if (isObj(a) && a.days !== undefined) {
      const ds = list(a.days).flatMap((d) => (text(d) ? [text(d)!] : []));
      if (ds.length) artistDays[artistId] = ds;
      else problems.push(`Festival "${festivalId}": the days for "${artistId}" should be a list like ["Friday"].`);
    }
    return [artistId];
  });
  const stages: Stage[] = list(raw.stages).flatMap((s) => {
    const stageId = isObj(s) ? id(s.id) : undefined;
    const stageName = isObj(s) ? text(s.name) : undefined;
    if (stageId && stageName) return [{ id: stageId, name: stageName }];
    problems.push(`Festival "${festivalId}": each stage needs an id and a name.`);
    return [];
  });
  const days = list(raw.days).flatMap((d) => (text(d) ? [text(d)!] : []));

  const festival: Festival = { id: festivalId, name, dates, location, lineup, days, stages };
  if (Object.keys(notes).length) festival.notes = notes;
  if (Object.keys(artistDays).length) festival.artistDays = artistDays;
  if (Object.keys(artistWeekends).length) festival.artistWeekends = artistWeekends;
  // Where the venue is: { "lat": 28.4, "lon": -81.5 }.
  if (raw.place !== undefined) {
    const lat = isObj(raw.place) ? raw.place.lat : undefined;
    const lon = isObj(raw.place) ? raw.place.lon : undefined;
    if (typeof lat === 'number' && typeof lon === 'number' && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0))
      festival.place = { lat, lon };
    else problems.push(`Festival "${festivalId}": "place" should be { "lat": 28.4, "lon": -81.5 }, so it was ignored.`);
  }
  for (const [key, field] of [['start', 'startDate'], ['end', 'endDate']] as const) {
    if (raw[key] === undefined) continue;
    const day = isoDay(raw[key]);
    if (day) festival[field] = day;
    else problems.push(`Festival "${festivalId}": "${key}" should be a date like "2026-11-06".`);
  }
  if (festival.startDate && festival.endDate && festival.endDate < festival.startDate) {
    problems.push(`Festival "${festivalId}": it ends before it starts, so the dates were left out.`);
    delete festival.startDate;
    delete festival.endDate;
  }
  // A festival run over separate weekends: each one's first and last day, in order.
  if (raw.weekends !== undefined) {
    const runs = list(raw.weekends).map((w) => (isObj(w) ? { start: isoDay(w.start), end: isoDay(w.end) } : undefined));
    const ok =
      runs.length > 1 &&
      runs.every((r) => r?.start && r.end && r.end >= r.start) &&
      runs.every((r, j) => j === 0 || r!.start! > runs[j - 1]!.end!);
    if (ok) {
      festival.weekends = runs.map((r) => ({ start: r!.start!, end: r!.end! }));
      festival.startDate = festival.weekends[0].start;
      festival.endDate = festival.weekends[festival.weekends.length - 1].end;
    } else {
      problems.push(
        `Festival "${festivalId}": "weekends" should list two or more weekends in order, each like { "start": "2026-10-02", "end": "2026-10-04" }, so it was left out.`,
      );
    }
  }
  // Official links: tickets, the festival's own site, and where to stay.
  for (const key of ['tickets', 'website', 'stay'] as const) {
    if (raw[key] === undefined) continue;
    const url = safeImageUrl(raw[key]);
    if (url) festival.links = { ...festival.links, [key]: url };
    else problems.push(`Festival "${festivalId}": the ${key} link must start with https://, so it was ignored.`);
  }
  // A tickets link that earns a commission (the page says so beside it).
  if (raw.ticketsPartner !== undefined) {
    if (raw.ticketsPartner === true && festival.links?.tickets) festival.links = { ...festival.links, ticketsPartner: true };
    else if (raw.ticketsPartner !== false)
      problems.push(`Festival "${festivalId}": "ticketsPartner" should be true, next to a "tickets" link, so it was ignored.`);
  }
  // Where an imported festival came from, credited on its page.
  if (raw.source !== undefined) {
    const src = isObj(raw.source) ? raw.source : undefined;
    const name = src ? text(src.name) : undefined;
    const url = src ? safeImageUrl(src.url) : undefined;
    if (name && url) festival.source = { name: name.slice(0, 40), url };
    else problems.push(`Festival "${festivalId}": "source" should be { "name", "url" } with an https link, so it was left out.`);
  }
  if (raw.poster !== undefined) {
    const posterImageUrl = safeImageUrl(raw.poster);
    if (posterImageUrl) festival.posterImageUrl = posterImageUrl;
    else problems.push(`Festival "${festivalId}": the poster link must start with https://, so it was ignored.`);
  }

  if (raw.sets !== undefined) {
    const sets: SetTime[] = list(raw.sets).flatMap((s, j) => {
      const set = isObj(s)
        ? { artistId: id(s.artist), day: text(s.day), stageId: id(s.stage), start: s.start, end: s.end }
        : undefined;
      if (
        set?.artistId &&
        set.day &&
        set.stageId &&
        typeof set.start === 'string' &&
        typeof set.end === 'string' &&
        TIME.test(set.start) &&
        TIME.test(set.end)
      ) {
        const pad = (t: string) => t.padStart(5, '0');
        return [{ artistId: set.artistId, day: set.day, stageId: set.stageId, start: pad(set.start), end: pad(set.end) }];
      }
      problems.push(
        `Festival "${festivalId}": set ${j + 1} needs an artist, day, stage, and start and end times like "23:40".`,
      );
      return [];
    });
    if (sets.length) festival.sets = sets;
  }
  return festival;
}

function parseClip(raw: unknown, i: number, problems: string[]): Clip | undefined {
  const where = `Clip ${i + 1}`;
  if (!isObj(raw)) return void problems.push(`${where} isn't written as { ... }, so it was left out.`);
  const clipId = id(raw.id);
  if (!clipId) return void problems.push(`${where} ${label(raw.title, '')} needs an id made of letters, numbers and dashes.`);
  const artistId = id(raw.artist);
  const festivalId = id(raw.festival);
  const title = text(raw.title);
  if (!artistId || !festivalId || !title) return void problems.push(`Clip "${clipId}" needs an artist, a festival and a title.`);
  const bpm = typeof raw.bpm === 'number' && raw.bpm >= 60 && raw.bpm <= 200 ? raw.bpm : DEFAULT_BPM;

  let source: YouTubeClipSource | undefined;
  if (raw.video !== undefined) {
    const v = isObj(raw.video) ? raw.video : {};
    const link = parseYouTubeLink(v.link);
    const start = parseSeconds(v.from);
    const end = parseSeconds(v.to);
    const channel = text(v.channel);
    if (!link) problems.push(`Clip "${clipId}": the video link isn't a YouTube link, so it shows the stage instead.`);
    else if (start == null || end == null || end <= start)
      problems.push(`Clip "${clipId}": the video needs "from" and "to" times like "25:00" and "25:45", with "to" later.`);
    else if (end - start > MAX_CLIP_SEC)
      problems.push(`Clip "${clipId}": keep clips under ${MAX_CLIP_SEC / 60} minutes, so the video was left out.`);
    else if (!channel) problems.push(`Clip "${clipId}": say which official channel the video is from.`);
    else {
      source = { provider: 'youtube', videoId: link.videoId, start, end, channel };
      // A Short, or a video marked upright (the nightly clip finder asks YouTube for each video's shape).
      if (link.vertical || v.vertical === true) source.vertical = true;
      // A Short found by the nightly clip finder: the whole video, upright, spaced out in Discover.
      if (v.short === true) {
        source.short = true;
        source.vertical = true;
      }
    }
  }

  const seconds = source ? source.end - source.start : parseSeconds(raw.seconds);
  if (!seconds || seconds <= 0 || seconds > MAX_CLIP_SEC)
    return void problems.push(`Clip "${clipId}" needs a working video, or "seconds" for how long it runs.`);
  const clip: Clip = { id: clipId, artistId, festivalId, title, durationSec: seconds, bpm };
  if (source) clip.source = source;
  // A back to back: the other artists' ids ("with": ["kompany"]).
  const others = Array.isArray(raw.with) ? [...new Set(raw.with.map(id).filter((x): x is string => !!x && x !== artistId))].slice(0, 3) : [];
  if (others.length) clip.withArtistIds = others;
  return clip;
}

const TIME_OF_DAY = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** A lineup published on its own (see FestivalLineup in models.ts). */
function parseLineup(raw: unknown, problems: string[]): FestivalLineup | undefined {
  const festivalId = isObj(raw) ? id(raw.festival) : undefined;
  if (!isObj(raw) || !festivalId) {
    problems.push('A "lineups" entry needs a festival id and its artists, so it was left out.');
    return undefined;
  }
  const artistIds = [...new Set(list(raw.artists).map(id).filter((x): x is string => !!x))];
  if (!artistIds.length) {
    problems.push(`Lineup "${festivalId}" names no artists, so it was left out.`);
    return undefined;
  }
  const lineup: FestivalLineup = { festivalId, artistIds };
  if (raw.sets !== undefined) {
    const sets: SetTime[] = [];
    for (const s of list(raw.sets)) {
      const set = isObj(s) ? { artistId: id(s.artist), day: text(s.day), stageId: id(s.stage), start: text(s.start), end: text(s.end) } : undefined;
      if (set?.artistId && set.day && set.stageId && set.start && set.end && TIME_OF_DAY.test(set.start) && TIME_OF_DAY.test(set.end))
        sets.push({ artistId: set.artistId, day: set.day, stageId: set.stageId, start: set.start, end: set.end });
      else problems.push(`Lineup "${festivalId}": a set needs an artist, a day, a stage and "start" and "end" times like "23:30", so one was left out.`);
    }
    lineup.sets = sets;
  }
  if (raw.days !== undefined) lineup.days = list(raw.days).map(text).filter((d): d is string => !!d);
  if (raw.stages !== undefined) {
    lineup.stages = list(raw.stages)
      .map((s) => (isObj(s) ? { id: id(s.id), name: text(s.name) } : undefined))
      .filter((s): s is Stage => !!s?.id && !!s.name) as Stage[];
  }
  if (raw.source === 'page') lineup.source = 'page';
  return lineup;
}

function parseSimilar(raw: unknown, problems: string[]): ArtistSimilarity | undefined {
  const s = isObj(raw) ? { artistId: id(raw.artist), otherId: id(raw.other), score: raw.score } : undefined;
  if (s?.artistId && s.otherId && typeof s.score === 'number' && s.score >= 0 && s.score <= 1)
    return { artistId: s.artistId, otherId: s.otherId, score: s.score };
  problems.push('A "similar" entry needs an artist, another artist and a score from 0 to 1.');
  return undefined;
}

/** At most this many shows are read from a file, and this many artists per show. */
export const MAX_SHOWS = 3000;
export const MAX_SHOW_ARTISTS = 12;

/** A club show (see Show in models.ts), or undefined when it's missing its id, day, venue, https link or artists. */
function parseShow(raw: unknown): Show | undefined {
  if (!isObj(raw)) return undefined;
  const showId = id(raw.id);
  const date = isoDay(raw.date);
  const venue = text(raw.venue);
  const link = safeImageUrl(raw.link);
  const artistIds = [...new Set(list(raw.artists).flatMap((a) => (id(a) ? [id(a)!] : [])))].slice(0, MAX_SHOW_ARTISTS);
  if (!showId || !date || !venue || !link || !artistIds.length) return undefined;
  const show: Show = { id: showId, date, venue, location: text(raw.location) ?? '', link, artistIds };
  const name = text(raw.name);
  if (name) show.name = name;
  const lat = isObj(raw.place) ? raw.place.lat : undefined;
  const lon = isObj(raw.place) ? raw.place.lon : undefined;
  if (typeof lat === 'number' && typeof lon === 'number' && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0)) show.place = { lat, lon };
  return show;
}

/**
 * What each festival of a file wrote, when any is written only in part
 * (without its lineup, days or stages) or adds to itself ("add"); undefined
 * for a file of whole festivals. Additions are read like a festival's own.
 */
function partsOf(raws: unknown[], festivals: readonly Festival[], problems: string[]): Record<string, FestivalParts> | undefined {
  const parsedIds = new Set(festivals.map((f) => f.id));
  const out: Record<string, FestivalParts> = {};
  let partial = false;
  raws.forEach((raw, i) => {
    const festivalId = isObj(raw) ? id(raw.id) : undefined;
    if (!isObj(raw) || !festivalId || !parsedIds.has(festivalId)) return;
    const given = FESTIVAL_PARTS.filter((k) => raw[k] !== undefined);
    if (!given.includes('lineup') || !given.includes('days') || !given.includes('stages') || raw.add !== undefined) partial = true;
    const parts: FestivalParts = { given };
    if (raw.add !== undefined) {
      if (!isObj(raw.add)) problems.push(`Festival "${festivalId}": "add" should be written as { "lineup", "days", "stages", "sets" }, so it was left out.`);
      else {
        const a = raw.add;
        const read = parseFestival({ id: festivalId, name: festivalId, dates: '-', lineup: a.lineup, days: a.days, stages: a.stages, sets: a.sets }, i, problems);
        if (read) {
          const { lineup, days, stages, sets, notes, artistDays, artistWeekends } = read;
          parts.add = { lineup, days, stages, ...(sets ? { sets } : {}), ...(notes ? { notes } : {}), ...(artistDays ? { artistDays } : {}), ...(artistWeekends ? { artistWeekends } : {}) };
        }
      }
    }
    out[festivalId] = parts;
  });
  return partial ? out : undefined;
}

/** Read a catalogue file (already parsed from JSON, or the raw text). Never throws. */
export function parseCatalogFile(input: unknown): ParsedFile {
  let raw = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return { mode: 'add', problems: ["The file isn't valid JSON. Check for a missing comma, quote or bracket."] };
    }
  }
  if (!isObj(raw)) return { mode: 'add', problems: ['The file should start with { and end with }.'] };
  if (raw.version !== FILE_VERSION)
    return { mode: 'add', problems: [`The file needs "version": ${FILE_VERSION}. This app can't read other versions.`] };

  const problems: string[] = [];
  const mode: FileMode = raw.mode === 'replace' ? 'replace' : 'add';
  if (raw.mode !== undefined && raw.mode !== 'add' && raw.mode !== 'replace')
    problems.push('"mode" should be "add" or "replace". Using "add".');

  const pick = <T,>(values: (T | undefined)[]) => values.filter((v): v is T => v !== undefined);
  const snapshot: CatalogSnapshot = {
    artists: pick(list(raw.artists).map((a, i) => parseArtist(a, i, problems))),
    festivals: pick(list(raw.festivals).map((f, i) => parseFestival(f, i, problems))),
    clips: pick(list(raw.clips).map((c, i) => parseClip(c, i, problems))),
  };
  if (raw.similar !== undefined) snapshot.similarities = pick(list(raw.similar).map((s) => parseSimilar(s, problems)));
  // Lineups published on their own (set times read from official pages each night): [{ "festival", "artists", "sets", "days", "stages", "source" }].
  if (raw.lineups !== undefined) {
    const lineups = pick(list(raw.lineups).map((l) => parseLineup(l, problems)));
    if (lineups.length) snapshot.lineups = lineups;
  }
  // Club shows from the nightly EDMTrain feed: [{ "id", "date", "venue", "link", "artists", … }].
  if (raw.shows !== undefined) {
    if (!Array.isArray(raw.shows)) problems.push('"shows" should be a list like [{ "id", "date", "venue", "link", "artists" }], so it was left out.');
    else {
      const shows = pick(raw.shows.slice(0, MAX_SHOWS).map(parseShow));
      const bad = Math.min(raw.shows.length, MAX_SHOWS) - shows.length;
      if (bad) problems.push(`${bad} ${bad === 1 ? 'show was' : 'shows were'} left out: each needs an id, a date like "2026-10-18", a venue, an https link and its artists.`);
      if (shows.length) snapshot.shows = shows;
    }
  }
  // SoundCloud pages matched each night: { "artist-id": { "url": "https://soundcloud.com/…", "name"?, "image"? } }.
  if (raw.soundcloud !== undefined) {
    if (!isObj(raw.soundcloud)) problems.push('"soundcloud" should be written as { "artist-id": { "url": "https://soundcloud.com/…" } }, so it was left out.');
    else {
      const pages: Record<string, SoundCloudProfile> = {};
      let bad = 0;
      for (const [key, value] of Object.entries(raw.soundcloud)) {
        const page = soundcloudProfile(value);
        if (id(key) && page) pages[key] = page;
        else bad++;
      }
      if (bad) problems.push(`${bad} SoundCloud ${bad === 1 ? 'link was' : 'links were'} left out: each needs an artist id and a link like https://soundcloud.com/their-name.`);
      if (Object.keys(pages).length) snapshot.soundcloud = pages;
    }
  }
  const festivalParts = partsOf(list(raw.festivals), snapshot.festivals, problems);
  const updated = text(raw.updated);
  const parsed: ParsedFile = updated ? { snapshot, mode, updated, problems } : { snapshot, mode, problems };
  if (festivalParts) parsed.festivalParts = festivalParts;
  // Photos for artists that have none of their own: { "artist-id": "https://…" }.
  if (raw.photos !== undefined) {
    if (!isObj(raw.photos)) problems.push('"photos" should be written as { "artist-id": "https://…" }, so it was left out.');
    else {
      const photos: Record<string, string> = {};
      let bad = 0;
      for (const [key, value] of Object.entries(raw.photos)) {
        const url = safeImageUrl(value);
        if (id(key) && url) photos[key] = url;
        else bad++;
      }
      if (bad) problems.push(`${bad} ${bad === 1 ? 'photo was' : 'photos were'} left out: each needs an artist id and an https link.`);
      if (Object.keys(photos).length) parsed.photos = photos;
    }
  }
  // Pictures from festivals' official sites: { "festival-id": "https://…" }. Bad entries are quietly left out.
  if (isObj(raw.sitePictures)) {
    const sitePictures: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw.sitePictures)) {
      const url = safeImageUrl(value);
      if (id(key) && url) sitePictures[key] = url;
    }
    if (Object.keys(sitePictures).length) parsed.sitePictures = sitePictures;
  }
  // Photos for artists playing in a b2b who aren't on Afterglow themselves: { "CRANKDAT": "https://…" }. Bad entries are quietly left out.
  if (isObj(raw.memberPhotos)) {
    const memberPhotos: Record<string, string> = {};
    for (const [name, value] of Object.entries(raw.memberPhotos)) {
      const url = safeImageUrl(value);
      if (url && name.trim() && name.length <= MAX_TEXT) memberPhotos[name.trim()] = url;
    }
    if (Object.keys(memberPhotos).length) parsed.memberPhotos = memberPhotos;
  }
  // Colours for artists, from their photos: { "artist-id": "#8E6BFF" }. Bad entries are quietly left out.
  if (isObj(raw.colors)) {
    const colors: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw.colors)) if (id(key) && typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) colors[key] = value.toUpperCase();
    if (Object.keys(colors).length) parsed.colors = colors;
  }
  // Videos reported as wrong: ["dQw4w9WgXcQ", "https://youtu.be/…"]. Anything that isn't a YouTube video is quietly left out.
  if (Array.isArray(raw.blockedVideos)) {
    const ids = raw.blockedVideos.map((v) => parseYouTubeLink(v)?.videoId).filter((v): v is string => !!v);
    if (ids.length) parsed.blockedVideos = [...new Set(ids)];
  }
  const credit = text(raw.photoCredit);
  if (credit) parsed.photoCredit = credit.slice(0, 40);
  return parsed;
}
