import { fold } from './edmtrain';

/**
 * Live-set clips for Discover from YouTube, found by the nightly job
 * (scripts/youtube-clips.ts) and published in the hosted catalogue. Chosen by
 * the owner on 2026-09-30: any channel. Since 2026-10-06 (the owner: "it can
 * keep pulling more videos for the feed, not just one per artist") each
 * artist can have up to MAX_CLIPS_PER_ARTIST different sets, and one search
 * can bring in up to NEW_PER_SEARCH of them. Pure: the job does the fetching.
 *
 * For each artist the job searches "<name> live set" (embeddable videos
 * only), reads the candidates' details, and keeps the best one: the title
 * must name the artist and look like a set (live, set, full set, festival
 * words), it must run at least MIN_SET_MINUTES, and it must be public and
 * embeddable. The artist's own channel, and well-known festival and live-set
 * channels, rank first. The clip is a one-minute section a third of the way
 * in, past the intro.
 */

/** YouTube's free daily quota is 10,000 units and a search costs 100: this leaves room for the details calls. */
export const MAX_SEARCHES = 90;
/** A search that found nothing is tried again after this many days. */
export const RETRY_MISSES_DAYS = 30;
/** Different live sets kept per artist (their first clip, then more). */
export const MAX_CLIPS_PER_ARTIST = 4;
/** New sets one search may bring in for an artist: one search answer lists several. */
export const NEW_PER_SEARCH = 2;
/** An artist searched for more sets with nothing new found is asked again after this many days. */
export const RETRY_MORE_DAYS = 21;
/** Videos a search answer lists (a search costs the same 100 units however many it lists, up to 50). */
export const SEARCH_RESULTS = 15;
/** New extra clips stop once the file would pass this share of the app's size limit. */
export const CLIP_BUDGET_SHARE = 0.85;
/** An artist's first clip, and clips found on earlier nights, may fill the file up to this share. */
export const FIRST_CLIP_SHARE = 0.95;
/** What to search for, by how many clips the artist already has: a different search brings different sets. */
export const CLIP_QUERIES = ['live set', 'full set', 'festival set'] as const;
/** Shorter videos are clips of a set, reactions or trailers, not a set. */
export const MIN_SET_MINUTES = 10;
/** How long each Discover clip runs. */
export const CLIP_SECONDS = 60;

/** Festival and live-set channels whose uploads are almost always real sets. */
export const KNOWN_CHANNELS = [
  'insomniac',
  'insomniacevents',
  'tomorrowland',
  'ultramusicfestival',
  'lostlands',
  'excision',
  'boilerroom',
  'cercle',
  'defqon1',
  'q-dance',
  'qdance',
  'electricdaisycarnival',
  'beyondwonderland',
  'dirtybird',
  'mixmag',
  'hörberlin',
  'lollapalooza',
  'aclfestival',
  'coachella',
  'bassrush',
  'wakaan',
  'monstercat',
  'ukf',
  'mtvbeatsmusic',
].map(fold);

/** The search for an artist who has `have` clips already ("<name> live set" for the first). */
export const searchUrl = (name: string, key: string, have = 0) =>
  `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=${SEARCH_RESULTS}&q=${encodeURIComponent(
    `${name} ${CLIP_QUERIES[Math.max(0, Math.floor(have)) % CLIP_QUERIES.length]}`,
  )}&key=${encodeURIComponent(key)}`;

export const detailsUrl = (ids: string[], key: string) =>
  `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status,player&maxHeight=720&id=${ids.join(',')}&key=${encodeURIComponent(key)}`;

/** Just the players of up to 50 videos (1 unit of quota): enough to learn each video's shape. */
export const shapesUrl = (ids: string[], key: string) =>
  `https://www.googleapis.com/youtube/v3/videos?part=player&maxHeight=720&id=${ids.join(',')}&key=${encodeURIComponent(key)}`;

/**
 * Whether a video was uploaded upright (filmed on a phone held up), from the
 * size YouTube suggests for its player: asked for with a `maxHeight`, it
 * answers in the video's own shape. Undefined when it doesn't say. A video
 * with black bars filmed into a wide frame still reads as wide: those can't
 * be cropped (the YouTube player mustn't be cut down), so they keep the wide
 * player.
 */
export function uprightOf(item: unknown): boolean | undefined {
  const p = (item as { player?: { embedWidth?: unknown; embedHeight?: unknown } } | null)?.player;
  const w = Number(p?.embedWidth);
  const h = Number(p?.embedHeight);
  if (!(w > 0) || !(h > 0)) return undefined;
  return h > w * 1.1;
}

/** Each video's shape in a details or shapes answer: id -> upright. Videos YouTube didn't size are left out. */
export function videoShapes(answer: unknown): Record<string, boolean> {
  const items = (answer as { items?: unknown } | null)?.items;
  const out: Record<string, boolean> = {};
  if (!Array.isArray(items)) return out;
  for (const it of items) {
    const id = (it as { id?: unknown })?.id;
    const up = uprightOf(it);
    if (typeof id === 'string' && up !== undefined) out[id] = up;
  }
  return out;
}

/** The video ids in a search answer. */
export function searchIds(answer: unknown): string[] {
  const items = (answer as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => (it as { id?: { videoId?: unknown } })?.id?.videoId)
    .filter((v): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{11}$/.test(v));
}

/** "PT1H2M3S" -> 3723 seconds. */
export function isoSeconds(d: unknown): number | undefined {
  if (typeof d !== 'string') return undefined;
  const m = d.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return undefined;
  const [, dd, h, mi, s] = m.map((x) => Number(x ?? 0));
  return dd * 86400 + h * 3600 + mi * 60 + s;
}

export type LiveSet = { videoId: string; title: string; channel: string; seconds: number; score: number; upright?: boolean };

const SET_WORDS = /\b(live|set|dj set|full set|festival|stage|boiler room|cercle|b2b)\b/i;
const NOT_A_SET = /\b(reaction|reacts|tutorial|how to|interview|trailer|teaser|aftermovie|lyrics|lyric video|official video|music video|karaoke|cover|remix pack|sample pack|full album|podcast)\b/i;

/** Every real live set for an artist in a details answer, best first. Videos reported as wrong (`blocked`) are left out. */
export function liveSets(artistName: string, details: unknown, blocked: ReadonlySet<string> = new Set()): LiveSet[] {
  const want = fold(artistName);
  if (want.length < 2) return [];
  const items = (details as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  const found: LiveSet[] = [];
  for (const raw of items) {
    const it = raw as {
      id?: unknown;
      snippet?: { title?: unknown; channelTitle?: unknown; liveBroadcastContent?: unknown };
      contentDetails?: { duration?: unknown };
      status?: { embeddable?: unknown; privacyStatus?: unknown };
    };
    const videoId = typeof it.id === 'string' ? it.id : undefined;
    const title = typeof it.snippet?.title === 'string' ? it.snippet.title : '';
    const channel = typeof it.snippet?.channelTitle === 'string' ? it.snippet.channelTitle : '';
    const seconds = isoSeconds(it.contentDetails?.duration);
    if (!videoId || !title || !channel || !seconds || blocked.has(videoId)) continue;
    if (it.status?.embeddable !== true || it.status?.privacyStatus !== 'public') continue;
    if (it.snippet?.liveBroadcastContent && it.snippet.liveBroadcastContent !== 'none') continue;
    if (seconds < MIN_SET_MINUTES * 60 || seconds > 6 * 3600) continue;
    if (!fold(title).includes(want)) continue;
    if (NOT_A_SET.test(title) || !SET_WORDS.test(title)) continue;
    const ch = fold(channel);
    let score = 0;
    if (ch.includes(want) || want.includes(ch)) score += 4; // the artist's own channel
    if (KNOWN_CHANNELS.some((k) => ch.includes(k))) score += 3;
    if (/\bfull set\b/i.test(title)) score += 1;
    if (seconds >= 30 * 60 && seconds <= 150 * 60) score += 1;
    found.push({ videoId, title, channel, seconds, score, ...(uprightOf(raw) ? { upright: true } : {}) });
  }
  // Best score first; the search's own order breaks ties.
  return found
    .map((f, i) => ({ f, i }))
    .sort((a, b) => b.f.score - a.f.score || a.i - b.i)
    .map((x) => x.f)
    .filter((f, i, all) => all.findIndex((g) => g.videoId === f.videoId) === i);
}

/** The best live set for an artist among a details answer, or undefined. Videos reported as wrong (`blocked`) are never picked. */
export function pickLiveSet(artistName: string, details: unknown, blocked: ReadonlySet<string> = new Set()): LiveSet | undefined {
  return liveSets(artistName, details, blocked)[0];
}

/** Words that say nothing about which set it was. */
const FILLER = new Set(
  'live set sets full dj at the from in on of a an and with official video videos hd 4k uhd stream livestream mix performance concert show part'.split(' '),
);

const words = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * What tells one of an artist's sets from another, from its title: the words
 * left without the artist's name and filler ("Live at EDC Orlando 2025" ->
 * edc, orlando, 2025).
 */
export function setWords(artistName: string, title: string): string[] {
  const name = new Set(words(artistName));
  return [...new Set(words(title).filter((w) => !name.has(w) && !FILLER.has(w)))];
}

/** Whether two titles (as `setWords`) are the same set, or too close to tell apart. */
export function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (!a.length || !b.length) return !a.length && !b.length;
  const A = new Set(a);
  const shared = b.filter((w) => A.has(w)).length;
  if (shared === a.length || shared === b.length) return true; // one says all the other does
  return shared / (a.length + b.length - shared) >= 0.6;
}

const yearOf = (title: string) => title.match(/\b(?:19|20)\d{2}\b/)?.[0];

/**
 * Up to `max` live sets from one details answer, each a different set: none
 * that looks like a set the artist already has (`taken`, their clips'
 * titles) or one picked before it. Best score first, with a set from a year
 * the artist has no clip from yet a step ahead.
 */
export function pickLiveSets(
  artistName: string,
  details: unknown,
  { blocked = new Set<string>(), taken = [], max = NEW_PER_SEARCH }: { blocked?: ReadonlySet<string>; taken?: readonly string[]; max?: number } = {},
): LiveSet[] {
  const have = taken.map((t) => setWords(artistName, t));
  const years = new Set(taken.map(yearOf).filter(Boolean));
  let left = liveSets(artistName, details, blocked);
  const out: LiveSet[] = [];
  while (out.length < max) {
    left = left.filter((s) => !have.some((h) => sameSet(h, setWords(artistName, s.title))));
    if (!left.length) break;
    const worth = (s: LiveSet) => {
      const y = yearOf(s.title);
      return s.score + (y && !years.has(y) ? 1 : 0);
    };
    const best = left.reduce((b, s) => (worth(s) > worth(b) ? s : b));
    out.push(best);
    left = left.filter((s) => s !== best);
    have.push(setWords(artistName, best.title));
    const y = yearOf(best.title);
    if (y) years.add(y);
  }
  return out;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** The clip's title: the video's, without the artist's name and leftover separators ("Live at Lost Lands 2025"). */
export function clipTitle(artistName: string, videoTitle: string): string {
  const esc = artistName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const t = videoTitle
    .replace(new RegExp(esc, 'gi'), '')
    .replace(/\s*[|•·]\s*/g, ' ')
    .replace(/^[\s\-–—:@,]+|[\s\-–—:@,]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const tidy = t.length >= 4 ? t.charAt(0).toUpperCase() + t.slice(1) : 'Live set';
  return tidy.length > 60 ? `${tidy.slice(0, 59).trimEnd()}…` : tidy;
}

/** A catalogue-file clip for a set: one minute, a third of the way in. */
export function setClip(set: LiveSet, artist: { id: string; name: string }, festivalId: string) {
  const from = Math.max(60, Math.round(set.seconds / 3));
  const to = Math.min(set.seconds - 5, from + CLIP_SECONDS);
  return {
    id: `yt-${set.videoId}`,
    artist: artist.id,
    festival: festivalId,
    title: clipTitle(artist.name, set.title),
    video: {
      link: `https://www.youtube.com/watch?v=${set.videoId}`,
      from: mmss(from),
      to: mmss(to),
      channel: set.channel.slice(0, 100),
      // Filmed upright: Discover gives it the tall, full-height player.
      ...(set.upright ? { vertical: true } : {}),
    },
  };
}


const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayMs = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
/** Whether `at` (a day) is fewer than `days` days before `today`. */
const within = (at: string | undefined, today: string, days: number) => !!at && DAY.test(at) && (dayMs(today) - dayMs(at)) / 86_400_000 < days;

/**
 * A remembered artist -> day list ("clipMisses", "clipMoreAsked") as read
 * from last night's file: only well-formed days, none after today, and none
 * old enough to have run out (those artists are asked again anyway).
 */
export function cleanAsked(raw: unknown, today: string, days: number): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, at] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof at === 'string' && at <= today && within(at, today, days) && id.length <= 200) out[id] = at;
  }
  return out;
}

export type PlanArtist = { id: string; name: string };
/** One search tonight, and how many clips the artist has going in. */
export type PlannedSearch = PlanArtist & { have: number };

/**
 * Who to search for tonight, at most `max`:
 *
 * 1. Artists on festivals that aren't over (`wanted`, in the order given:
 *    festivals you curated first, soonest first, billing order) who have no
 *    clip yet and weren't searched without luck in the last
 *    RETRY_MISSES_DAYS days (`misses`).
 * 2. Then artists with fewer than `cap` clips, fewest first: those in
 *    `wanted` before the rest (`later`), each in the order given; skipping
 *    anyone searched for more with nothing new found in the last
 *    RETRY_MORE_DAYS days (`moreAsked`).
 */
export function clipPlan(
  wanted: readonly PlanArtist[],
  clipCount: (artistId: string) => number | boolean,
  misses: Record<string, string>,
  today: string,
  max = MAX_SEARCHES,
  { moreAsked = {}, later = [], cap = MAX_CLIPS_PER_ARTIST }: { moreAsked?: Record<string, string>; later?: readonly PlanArtist[]; cap?: number } = {},
): PlannedSearch[] {
  const count = (id: string) => Number(clipCount(id)) || 0;
  const out: PlannedSearch[] = [];
  const seen = new Set<string>();
  for (const a of wanted) {
    if (out.length >= max) return out;
    if (seen.has(a.id) || count(a.id) > 0) continue;
    seen.add(a.id);
    if (within(misses[a.id], today, RETRY_MISSES_DAYS)) continue;
    out.push({ id: a.id, name: a.name, have: 0 });
  }
  const more: (PlannedSearch & { tier: number; at: number })[] = [];
  for (const [tier, list] of [wanted, later].entries()) {
    for (const a of list) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      const have = count(a.id);
      if (have <= 0 || have >= cap || within(moreAsked[a.id], today, RETRY_MORE_DAYS)) continue;
      more.push({ id: a.id, name: a.name, have, tier, at: more.length });
    }
  }
  more.sort((p, q) => p.tier - q.tier || p.have - q.have || p.at - q.at);
  for (const { id, name, have } of more.slice(0, Math.max(0, max - out.length))) out.push({ id, name, have });
  return out;
}

/**
 * Room for clips in the published file: `chars` is the file without its
 * clips, and each clip adds its own length plus a comma. A clip fits while
 * the file stays within `share` of the size limit.
 */
export function clipBudget(chars: number, limit: number) {
  let used = chars;
  const cost = (clip: unknown) => JSON.stringify(clip).length + 1;
  return {
    fits: (clip: unknown, share: number) => used + cost(clip) <= Math.floor(limit * share),
    add: (clip: unknown) => {
      used += cost(clip);
    },
    get chars() {
      return used;
    },
  };
}

/*
 * Shorts: short upright crowd clips of an artist playing live, filmed on a
 * phone (the owner, 2026-10-06: vertical clips "to see how real posts will
 * work"). Found by a few searches a night of their own, kept apart from the
 * long sets (their own cap, so they never crowd sets out), and played whole
 * from their start in the tall player.
 */

/** Shorts kept per artist, on top of their MAX_CLIPS_PER_ARTIST sets. */
export const MAX_SHORTS_PER_ARTIST = 2;
/** Of each night's searches, this many look for Shorts (more when the sets need fewer). */
export const SHORT_SEARCHES = 20;
/** New Shorts one search may bring in for an artist. */
export const NEW_SHORTS_PER_SEARCH = 2;
/** An artist searched for Shorts with nothing new found is asked again after this many days. */
export const RETRY_SHORTS_DAYS = 21;
/** A Short runs this long at least (shorter is a blip, not a moment)… */
export const MIN_SHORT_SECONDS = 15;
/** …and at most this long (the app's longest clip). */
export const MAX_SHORT_SECONDS = 180;

/** The Shorts search: "<name> live #shorts", short embeddable videos only. */
export const shortsUrl = (name: string, key: string) =>
  `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&videoDuration=short&maxResults=${SEARCH_RESULTS}&q=${encodeURIComponent(
    `${name} live #shorts`,
  )}&key=${encodeURIComponent(key)}`;

/** Live or crowd footage words. */
const LIVE_WORDS = /\b(live|set|festival|stage|drop|drops|dropped|crowd|front row|rave|rail|b2b|show|concert|lost lands|edc|ultra|tomorrowland|red rocks|boiler room)\b/i;
/** Not a moment of a show: production, reposts of tracks, reactions, edits. */
const NOT_LIVE = /\b(reaction|reacts|tutorial|how to|how i made|interview|podcast|trailer|teaser|lyrics|lyric video|official video|music video|karaoke|cover|remix|remixes|edit|mashup|type beat|fl studio|ableton|serum|sample pack|unboxing|merch|vlog|outfit|grwm|prank)\b/i;

/** A Short's title without its hashtags ("Subtronics drop at Lost Lands #shorts #edm" -> "Subtronics drop at Lost Lands"). */
export const withoutTags = (title: string) => title.replace(/#[^\s#]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

export type ShortClip = { videoId: string; title: string; channel: string; seconds: number; score: number };

/**
 * Up to `max` Shorts for an artist in a details answer (asked with the
 * player's size): upright, MIN_SHORT_SECONDS to MAX_SHORT_SECONDS, public,
 * embeddable, not live now, the title naming the artist and saying it's live
 * footage, never `blocked`, never a title the artist already has (`taken`).
 * The artist's own and well-known festival channels first, then search order.
 */
export function pickShorts(
  artistName: string,
  details: unknown,
  { blocked = new Set<string>(), taken = [], max = NEW_SHORTS_PER_SEARCH }: { blocked?: ReadonlySet<string>; taken?: readonly string[]; max?: number } = {},
): ShortClip[] {
  const want = fold(artistName);
  const items = (details as { items?: unknown } | null)?.items;
  if (want.length < 2 || !Array.isArray(items)) return [];
  const had = new Set(taken.map((t) => fold(withoutTags(t))));
  const found: (ShortClip & { i: number })[] = [];
  for (const [i, raw] of items.entries()) {
    const it = raw as {
      id?: unknown;
      snippet?: { title?: unknown; channelTitle?: unknown; liveBroadcastContent?: unknown };
      contentDetails?: { duration?: unknown };
      status?: { embeddable?: unknown; privacyStatus?: unknown };
    };
    const videoId = typeof it.id === 'string' ? it.id : undefined;
    const title = typeof it.snippet?.title === 'string' ? withoutTags(it.snippet.title) : '';
    const channel = typeof it.snippet?.channelTitle === 'string' ? it.snippet.channelTitle : '';
    const seconds = isoSeconds(it.contentDetails?.duration);
    if (!videoId || !title || !channel || !seconds || blocked.has(videoId)) continue;
    if (it.status?.embeddable !== true || it.status?.privacyStatus !== 'public') continue;
    if (it.snippet?.liveBroadcastContent && it.snippet.liveBroadcastContent !== 'none') continue;
    if (seconds < MIN_SHORT_SECONDS || seconds > MAX_SHORT_SECONDS) continue;
    if (uprightOf(raw) !== true) continue; // filmed on a phone held up
    if (!fold(title).includes(want) || NOT_LIVE.test(title) || !LIVE_WORDS.test(title)) continue;
    if (had.has(fold(title))) continue;
    const ch = fold(channel);
    let score = 0;
    if (ch.includes(want) || want.includes(ch)) score += 4;
    if (KNOWN_CHANNELS.some((k) => ch.includes(k))) score += 3;
    found.push({ videoId, title, channel, seconds, score, i });
  }
  const out: ShortClip[] = [];
  for (const { i: _i, ...s } of found.sort((a, b) => b.score - a.score || a.i - b.i)) {
    if (out.length >= max) break;
    if (out.some((o) => o.videoId === s.videoId || fold(o.title) === fold(s.title))) continue;
    out.push(s);
  }
  return out;
}

/** A catalogue-file clip for a Short: the whole video from its start, in the tall player. */
export function shortClip(short: ShortClip, artist: { id: string; name: string }, festivalId: string) {
  const seconds = Math.min(MAX_SHORT_SECONDS, Math.floor(short.seconds));
  return {
    id: `yt-${short.videoId}`,
    artist: artist.id,
    festival: festivalId,
    title: clipTitle(artist.name, withoutTags(short.title)),
    video: {
      link: `https://www.youtube.com/shorts/${short.videoId}`,
      from: '0:00',
      to: mmss(seconds),
      channel: short.channel.slice(0, 100),
      vertical: true,
      short: true,
    },
  };
}

/**
 * Who to search Shorts for tonight, at most `max`: artists on upcoming
 * festivals (`wanted`) before the rest (`later`), fewest Shorts first, each
 * in the order given; skipping anyone at `cap` or asked in the last
 * RETRY_SHORTS_DAYS days with nothing new found (`asked`).
 */
export function shortsPlan(
  wanted: readonly PlanArtist[],
  shortCount: (artistId: string) => number,
  asked: Record<string, string>,
  today: string,
  max = SHORT_SEARCHES,
  { later = [], cap = MAX_SHORTS_PER_ARTIST }: { later?: readonly PlanArtist[]; cap?: number } = {},
): PlannedSearch[] {
  const seen = new Set<string>();
  const list: (PlannedSearch & { tier: number; at: number })[] = [];
  for (const [tier, artists] of [wanted, later].entries()) {
    for (const a of artists) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      const have = Number(shortCount(a.id)) || 0;
      if (have >= cap || within(asked[a.id], today, RETRY_SHORTS_DAYS)) continue;
      list.push({ id: a.id, name: a.name, have, tier, at: list.length });
    }
  }
  list.sort((p, q) => p.tier - q.tier || p.have - q.have || p.at - q.at);
  return list.slice(0, Math.max(0, max)).map(({ id, name, have }) => ({ id, name, have }));
}
