import type { Artist, ArtistSimilarity, CatalogSnapshot, Clip, Festival, SetTime, SoundTag, Stage, YouTubeClipSource } from './models';
import { SOUND_TAGS } from './models';

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
 *   "artists":   [{ "id", "name", "sound": { "house": 1 }, "image"? }],
 *   "festivals": [{ "id", "name", "dates", "location", "start"?: "2026-11-06", "end"?: "2026-11-08",
 *                   "lineup": [artist ids, or { "artist", "note": "Sunset set", "days": ["Friday"], "weekend": 1 }],
 *                   "weekends"?: [{ "start", "end" }, ...],   // festivals run over separate weekends
 *                   "days"?, "stages"?: [{ "id", "name" }], "poster"?, "tickets"?, "website"?,
 *                   "sets"?: [{ "artist", "day", "stage", "start": "23:40", "end": "01:10" }] }],
 *   "clips":     [{ "id", "artist", "festival", "title",
 *                   "video"?: { "link", "from": "25:00", "to": "25:45", "channel" },
 *                   "seconds"?, "bpm"? }],
 *   "similar"?:  [{ "artist", "other", "score": 0.8 }]
 * }
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
};

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
  // Official links: tickets and the festival's own site.
  for (const key of ['tickets', 'website'] as const) {
    if (raw[key] === undefined) continue;
    const url = safeImageUrl(raw[key]);
    if (url) festival.links = { ...festival.links, [key]: url };
    else problems.push(`Festival "${festivalId}": the ${key} link must start with https://, so it was ignored.`);
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
      if (link.vertical) source.vertical = true;
    }
  }

  const seconds = source ? source.end - source.start : parseSeconds(raw.seconds);
  if (!seconds || seconds <= 0 || seconds > MAX_CLIP_SEC)
    return void problems.push(`Clip "${clipId}" needs a working video, or "seconds" for how long it runs.`);
  const clip: Clip = { id: clipId, artistId, festivalId, title, durationSec: seconds, bpm };
  if (source) clip.source = source;
  return clip;
}

function parseSimilar(raw: unknown, problems: string[]): ArtistSimilarity | undefined {
  const s = isObj(raw) ? { artistId: id(raw.artist), otherId: id(raw.other), score: raw.score } : undefined;
  if (s?.artistId && s.otherId && typeof s.score === 'number' && s.score >= 0 && s.score <= 1)
    return { artistId: s.artistId, otherId: s.otherId, score: s.score };
  problems.push('A "similar" entry needs an artist, another artist and a score from 0 to 1.');
  return undefined;
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
  const updated = text(raw.updated);
  return updated ? { snapshot, mode, updated, problems } : { snapshot, mode, problems };
}
