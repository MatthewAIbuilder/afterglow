import { fold } from './edmtrain';

/**
 * Live-set clips for Discover from YouTube, found by the nightly job
 * (scripts/youtube-clips.ts) and published in the hosted catalogue. Chosen by
 * the owner on 2026-09-30: any channel, best match per artist. Pure: the job
 * does the fetching.
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

export const searchUrl = (name: string, key: string) =>
  `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=10&q=${encodeURIComponent(
    `${name} live set`,
  )}&key=${encodeURIComponent(key)}`;

export const detailsUrl = (ids: string[], key: string) =>
  `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${ids.join(',')}&key=${encodeURIComponent(key)}`;

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

export type LiveSet = { videoId: string; title: string; channel: string; seconds: number; score: number };

const SET_WORDS = /\b(live|set|dj set|full set|festival|stage|boiler room|cercle|b2b)\b/i;
const NOT_A_SET = /\b(reaction|reacts|tutorial|how to|interview|trailer|teaser|aftermovie|lyrics|lyric video|official video|music video|karaoke|cover|remix pack|sample pack|full album|podcast)\b/i;

/** The best live set for an artist among a details answer, or undefined. Videos reported as wrong (`blocked`) are never picked. */
export function pickLiveSet(artistName: string, details: unknown, blocked: ReadonlySet<string> = new Set()): LiveSet | undefined {
  const want = fold(artistName);
  if (want.length < 2) return undefined;
  const items = (details as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return undefined;
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
    found.push({ videoId, title, channel, seconds, score });
  }
  // Best score first; the search's own order breaks ties.
  return found.map((f, i) => ({ f, i })).sort((a, b) => b.f.score - a.f.score || a.i - b.i)[0]?.f;
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
    video: { link: `https://www.youtube.com/watch?v=${set.videoId}`, from: mmss(from), to: mmss(to), channel: set.channel.slice(0, 100) },
  };
}

/**
 * Who to search for tonight: artists on festivals that aren't over, in the
 * order given (soonest festival first, billing order), who have no clip yet
 * and weren't searched without luck in the last RETRY_MISSES_DAYS days; at
 * most `max`.
 */
export function clipPlan(
  wanted: readonly { id: string; name: string }[],
  hasClip: (artistId: string) => boolean,
  misses: Record<string, string>,
  today: string,
  max = MAX_SEARCHES,
): { id: string; name: string }[] {
  const day = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  const out: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const a of wanted) {
    if (seen.has(a.id) || hasClip(a.id)) continue;
    seen.add(a.id);
    const missed = misses[a.id];
    if (missed && /^\d{4}-\d{2}-\d{2}$/.test(missed) && (day(today) - day(missed)) / 86_400_000 < RETRY_MISSES_DAYS) continue;
    out.push(a);
    if (out.length >= max) break;
  }
  return out;
}
