import type { Artist, SoundTag } from '../../data/types';
import { SOUND_TAGS } from '../../data/models';
import { carriesSound } from '../festivals/search';
import type { Similarity } from '../taste/similarity';
import { ARTIST_GAP, type FeedInput, type FeedItem, recency, scoreClips, SOUNDCLOUD_EVERY, SOUNDCLOUD_MIN_MATCH } from './feed';

/**
 * A station: "Sounds like SUBTRONICS". Discover plays one artist's sets and
 * the sets of artists who sound most like them, from every lineup and club
 * show. Pure and deterministic, like the main feed.
 *
 * Who's on it comes from the same similarity the taste engine uses for
 * spill-over (lineup and listening data first, sound tags otherwise). The
 * order blends how close each artist is to the one you started from with
 * your own live match, so what you like, save and skip still moves things:
 * artists you've turned down wait until the rest are through, clips you
 * skipped go last. The artist you started from opens the station and comes
 * back every few clips, never all at once.
 */

/** How alike an artist must be to the one you started from to be on the station. */
export const STATION_MIN = 0.35;
/** At most this many artists besides the one you started from. */
export const STATION_ARTISTS = 30;
/** With fewer clips than this, the station widens to everyone who carries the starting artist's sounds. */
export const STATION_CLIPS = 12;
/** Widening stops once the station has this many clips. */
export const STATION_WIDE_CLIPS = 24;
/** How much closeness to the starting artist counts, against your own match. */
export const CLOSE_WEIGHT = 0.6;
export const TASTE_WEIGHT = 0.4;
/** The starting artist's lift, so the station opens with them and they come back early. */
export const SEED_LIFT = 0.3;
/** The starting artist plays at most once in this many clips. */
export const SEED_GAP = 4;
/** Each clip an artist already has on the station holds their next one back by this much. */
const REPEAT = 0.25;
/** Clips you liked or saved come back a little later. */
const HAD_IT = 0.1;
/** Among clips seen lately, how much a very recent view holds a clip back. */
const RECENCY_WEIGHT = 0.5;
/** A SoundCloud card shows for an artist this close to the starting one (or a decent match). */
const SOUNDCLOUD_CLOSE = 0.6;

export type StationArtist = { artist: Artist; closeness: number };

/** The sounds an artist carries, or their strongest one when none is strong enough to count. */
function soundsOf(artist: Artist): SoundTag[] {
  const carried = SOUND_TAGS.filter((t) => carriesSound(artist, t));
  if (carried.length) return carried;
  let top: SoundTag | undefined;
  for (const t of SOUND_TAGS) if ((artist.sound[t] ?? 0) > 0 && (!top || (artist.sound[t] ?? 0) > (artist.sound[top] ?? 0))) top = t;
  return top ? [top] : [];
}

/**
 * Who's on a station, closest first: the artist you started from (when they
 * have clips), then up to STATION_ARTISTS who sound like them. Only artists
 * with clips count. Too few clips: everyone else who carries the starting
 * artist's sounds joins, closest first, until there's enough.
 */
export function stationArtists(seed: Artist, artists: readonly Artist[], clipCount: (artistId: string) => number, similarity: Similarity): StationArtist[] {
  const candidates = artists.filter((a) => a.id !== seed.id && clipCount(a.id) > 0).map((a, i) => ({ artist: a, closeness: similarity(seed, a), i }));
  const byCloseness = (x: { closeness: number; i: number }, y: { closeness: number; i: number }) => y.closeness - x.closeness || x.i - y.i;
  const close = candidates.filter((c) => c.closeness >= STATION_MIN).sort(byCloseness).slice(0, STATION_ARTISTS);
  const out: StationArtist[] = [];
  if (clipCount(seed.id) > 0) out.push({ artist: seed, closeness: 1 });
  for (const c of close) out.push({ artist: c.artist, closeness: c.closeness });
  let clips = out.reduce((n, s) => n + clipCount(s.artist.id), 0);
  if (clips >= STATION_CLIPS) return out;
  const sounds = soundsOf(seed);
  const on = new Set(out.map((s) => s.artist.id));
  const wider = candidates.filter((c) => !on.has(c.artist.id) && sounds.some((t) => carriesSound(c.artist, t))).sort(byCloseness);
  for (const c of wider) {
    if (clips >= STATION_WIDE_CLIPS) break;
    out.push({ artist: c.artist, closeness: c.closeness });
    clips += clipCount(c.artist.id);
  }
  return out;
}

const isPage = (it: FeedItem) => it.clip.source?.provider === 'soundcloud';

/**
 * A station's running order. `clips` are already only the station's artists;
 * `closeness` says how alike each is to `seedId` (1 for the seed). What's
 * kept stays put; then fresh clips, clips of artists you've turned down,
 * clips seen lately (least recently first) and clips you skipped, each block
 * by closeness and your match, spaced so no artist plays twice in a row and
 * the starting artist only every SEED_GAP clips. SoundCloud cards are set in
 * one every SOUNDCLOUD_EVERY cards, for artists close to the seed or a decent match.
 */
export function rankStation(input: FeedInput & { seedId: string; closeness: Record<string, number> }): FeedItem[] {
  const { seedId, closeness, taste } = input;
  const scored = scoreClips(input).map((it): FeedItem => {
    const id = it.clip.artistId;
    const r = input.reactions[it.clip.id];
    let score = CLOSE_WEIGHT * (closeness[id] ?? 0) + TASTE_WEIGHT * (taste[id] ?? 0) - (r?.liked || r?.saved ? HAD_IT : 0);
    const seed = id === seedId;
    if (seed) score += SEED_LIFT;
    return { ...it, score, lane: seed ? 'personal' : 'explore', reason: seed ? { kind: 'match' } : { kind: 'near', artistId: seedId } };
  });
  const byClip = new Map(scored.map((it) => [it.clip.id, it]));
  const kept: FeedItem[] = [];
  for (const id of input.keep ?? []) {
    const it = byClip.get(id);
    if (it && !kept.includes(it)) kept.push(it);
  }
  const keptIds = new Set(kept.map((it) => it.clip.id));
  const others = scored.filter((it) => !keptIds.has(it.clip.id));
  const rest = others.filter((it) => !isPage(it));
  const fresh = rest.filter((it) => !it.skipped && !it.seenRecently && !it.cooled);
  const cooled = rest.filter((it) => !it.skipped && !it.seenRecently && it.cooled);
  const stale = rest
    .filter((it) => !it.skipped && it.seenRecently)
    .map((it) => ({ ...it, score: it.score - RECENCY_WEIGHT * recency(input.seen[it.clip.id], input.now) }));
  const skipped = rest.filter((it) => it.skipped);

  const recent = kept.map((it) => it.clip.artistId);
  const placed: Record<string, number> = {};
  for (const id of recent) placed[id] = (placed[id] ?? 0) + 1;
  const out = [...kept];
  for (const block of [fresh, cooled, stale, skipped]) out.push(...spaced(block, recent, placed, seedId));

  const pages = others
    .filter(isPage)
    .filter((it) => !it.cooled && !it.skipped && ((closeness[it.clip.artistId] ?? 0) >= SOUNDCLOUD_CLOSE || (taste[it.clip.artistId] ?? 0) >= SOUNDCLOUD_MIN_MATCH))
    .sort(byScore);
  return withPages(out, kept.length, pages);
}

function byScore(a: FeedItem, b: FeedItem) {
  return b.score - a.score || a.clip.id.localeCompare(b.clip.id, undefined, { numeric: true });
}

/** Best first, holding back an artist heard in the last ARTIST_GAP clips (the seed: SEED_GAP) while anyone else can go. */
function spaced(items: FeedItem[], recent: string[], placed: Record<string, number>, seedId: string): FeedItem[] {
  const left = [...items];
  const out: FeedItem[] = [];
  const effective = (it: FeedItem) => it.score - REPEAT * (placed[it.clip.artistId] ?? 0);
  const best = (ok: (it: FeedItem) => boolean) => {
    let at = -1;
    for (let i = 0; i < left.length; i++) {
      if (!ok(left[i])) continue;
      if (at < 0 || effective(left[i]) > effective(left[at]) || (effective(left[i]) === effective(left[at]) && byScore(left[i], left[at]) < 0)) at = i;
    }
    return at;
  };
  while (left.length) {
    const near = new Set(recent.slice(-ARTIST_GAP));
    const seedHeard = recent.slice(-(SEED_GAP - 1)).includes(seedId);
    let at = best((it) => !near.has(it.clip.artistId) && !(seedHeard && it.clip.artistId === seedId));
    if (at < 0) at = best((it) => it.clip.artistId !== recent[recent.length - 1]);
    if (at < 0) at = best(() => true);
    const [it] = left.splice(at, 1);
    out.push(it);
    recent.push(it.clip.artistId);
    placed[it.clip.artistId] = (placed[it.clip.artistId] ?? 0) + 1;
  }
  return out;
}

/** SoundCloud cards set in after what's kept: one after every SOUNDCLOUD_EVERY - 1 other cards, never beside the same artist. */
function withPages(feed: FeedItem[], keptCount: number, pages: FeedItem[]): FeedItem[] {
  if (!pages.length) return feed;
  const out = feed.slice(0, keptCount);
  let since = 0;
  for (const it of out) since = isPage(it) ? 0 : since + 1;
  const left = [...pages];
  for (const it of feed.slice(keptCount)) {
    if (since >= SOUNDCLOUD_EVERY - 1 && left.length) {
      const before = out[out.length - 1]?.clip.artistId;
      const i = left.findIndex((p) => p.clip.artistId !== before && p.clip.artistId !== it.clip.artistId);
      if (i >= 0) {
        out.push(left.splice(i, 1)[0]);
        since = 0;
      }
    }
    out.push(it);
    since++;
  }
  return out;
}

/** Stations remembered on the phone for What to discover. */
export const RECENT_STATIONS = 3;

/** A station you just started goes first; at most RECENT_STATIONS, no repeats. */
export function addStation(list: readonly string[], artistId: string): string[] {
  return [artistId, ...list.filter((id) => id !== artistId)].slice(0, RECENT_STATIONS);
}

/** Saved stations read back safely. */
export function cleanStations(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && !!id))].slice(0, RECENT_STATIONS);
}
