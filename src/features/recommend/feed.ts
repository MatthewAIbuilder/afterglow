import { partnersOf } from '../../data/b2b';
import type { Artist, Clip, TasteProfile } from '../../data/types';
import type { Reaction } from '../../state/reactions';
import { isCold, type Rating, type Ratings } from '../taste/ratings';
import { type Similarity, soundSimilarity } from '../taste/similarity';

/** A direct rating in the feed's tally of likes and skips per artist. */
const RATING_NET: Record<Rating, number> = { love: 1, like: 0.6, ok: 0, meh: -0.5, pass: -1 };

/**
 * Discover's running order. Pure and deterministic: the same taste, reactions
 * and viewing history always give the same feed, and every pick says why it
 * is there. No model, no randomness.
 *
 * It reads the taste engine's live match (which already folds in likes, saves,
 * skips, watch behaviour and spill-over to similar sounds) and adds what only
 * the feed knows about: which clips you have seen lately, and which clips you
 * skipped.
 *
 * Every artist falls into one lane:
 * - personal: a strong match.
 * - explore: not a strong match yet, but close in sound to your top artists.
 * - discover: a different direction, or someone the engine knows nothing about.
 *
 * The feed takes turns between lanes in a fixed pattern (mostly personal,
 * regular exploring, the occasional new direction), never plays the same
 * artist twice in a row when it can avoid it, gives each artist one clip
 * before anyone gets a second, and spaces short crowd clips (Shorts) out
 * among the longer sets. Order of blocks: fresh clips, then clips of
 * artists you've turned down (more skips and "not for me" than likes, saves
 * and loves), then clips
 * you saw lately, then the clips you skipped.
 */

export type Lane = 'personal' | 'explore' | 'discover';

/** Why a clip is where it is. Plain data, so the UI can put it into words. */
export type Reason =
  | { kind: 'match' }
  | { kind: 'near'; artistId: string }
  | { kind: 'new-sound' }
  | { kind: 'unknown' };

export type FeedItem = {
  clip: Clip;
  lane: Lane;
  reason: Reason;
  /** Higher plays sooner within its lane. */
  score: number;
  /** Seen within the recent window, so it waits until the fresh clips are through. */
  seenRecently: boolean;
  /** You skipped this clip: it goes last. */
  skipped: boolean;
  /** You've turned this artist down (more skips than likes and saves): they wait until the fresh clips are through. */
  cooled: boolean;
};

/** Match needed for the personal lane. Same line as a "strong match" in your festival plan. */
export const PERSONAL_AT = 0.75;
/** How close in sound to one of your top artists counts as related. */
export const NEAR_AT = 0.3;
/** How many of your top artists anchor "related". */
const ANCHORS = 3;
/** Seen within this long ago counts as seen recently. */
export const RECENT_MS = 6 * 60 * 60 * 1000;
/** Clips you liked or saved are ones you've had; they come back, just a little later. */
const HAD_IT = 0.1;
/** In the discover lane, someone you've never reacted to comes before someone you have... */
const UNTOUCHED = 0.2;
/** ...and someone the engine knows nothing about comes first of all. */
const UNKNOWN = 0.1;
/** Each clip an artist already has in the feed holds their next one back by this much. */
const REPEAT = 0.25;
/** In the explore lane, closeness to your sound counts alongside the match. */
const NEAR_WEIGHT = 0.3;
/** Among clips seen lately, how much a very recent view holds a clip back. */
const RECENCY_WEIGHT = 0.5;

/**
 * The turn each lane gets, repeated: half personal, a third exploring, one in
 * six a new direction. The first slot is always your strongest match.
 */
export const PATTERN: readonly Lane[] = ['personal', 'personal', 'explore', 'personal', 'explore', 'discover'];
/** When a lane has nothing left, the next lane to try. */
const FALLBACK: Record<Lane, readonly Lane[]> = {
  personal: ['personal', 'explore', 'discover'],
  // Exploring is a step out from your sound, so an empty turn goes back to it, not further out.
  explore: ['explore', 'personal', 'discover'],
  discover: ['discover', 'explore', 'personal'],
};
/** Try not to repeat an artist within this many clips. */
export const ARTIST_GAP = 2;

/** Short crowd clips (YouTube Shorts) wait while one of the last this many clips was a Short: at most one in three. */
export const SHORT_GAP = 2;
/** …and get a turn of their own at least once in this many clips, so they're mixed in rather than left to the end. */
export const SHORT_EVERY = 4;
/** A short crowd clip (a YouTube Short from the nightly import). */
export const isShort = (clip: Clip) => clip.source?.provider === 'youtube' && !!clip.source.short;

/** At most one SoundCloud card in this many cards (so five others between two). */
export const SOUNDCLOUD_EVERY = 6;
/** A SoundCloud card is shown for a match at least this strong, or for an artist you've shown you like. */
export const SOUNDCLOUD_MIN_MATCH = 0.6;

const isPage = (clip: Clip) => clip.source?.provider === 'soundcloud';

/** When you last saw each clip, in ms since the epoch. */
export type SeenHistory = Record<string, number>;

export type FeedInput = {
  clips: Clip[];
  artists: Artist[];
  taste: TasteProfile;
  /** Which matches rest on real signal (from the taste engine). Missing means yes if there's a score. */
  informed?: Record<string, boolean>;
  reactions: Record<string, Reaction>;
  seen: SeenHistory;
  now: number;
  /** Clip ids already laid out (on screen or next up). Kept as they are, in order; the rest follows. */
  keep?: readonly string[];
  /** How alike two artists are. Sound tags by default. */
  similarity?: Similarity;
  /** Artists rated directly: "not for me" turns an artist down like a skip ("not really" half as much); "love" and "like" raise them through the match. */
  ratings?: Ratings;
};

/** Your top artists by match, strong matches only. What "related" is measured against. */
export function anchorsOf(artists: Artist[], taste: TasteProfile, informed?: Record<string, boolean>) {
  return artists
    .filter((a) => (taste[a.id] ?? 0) >= PERSONAL_AT && isKnown(a.id, taste, informed))
    .sort((a, b) => (taste[b.id] ?? 0) - (taste[a.id] ?? 0) || a.id.localeCompare(b.id))
    .slice(0, ANCHORS);
}

function isKnown(id: string, taste: TasteProfile, informed?: Record<string, boolean>) {
  return informed ? !!informed[id] : id in taste;
}

/** Which lane an artist is in right now, and why. */
export function laneOf(
  artist: Artist,
  taste: TasteProfile,
  anchors: Artist[],
  informed?: Record<string, boolean>,
  similarity: Similarity = soundSimilarity,
): { lane: Lane; reason: Reason; nearness: number } {
  let nearness = 0;
  let nearTo: Artist | undefined;
  for (const a of anchors) {
    if (a.id === artist.id) continue;
    const s = similarity(artist, a);
    if (s > nearness) {
      nearness = s;
      nearTo = a;
    }
  }
  if (!isKnown(artist.id, taste, informed)) {
    // No real signal: close to your sound is exploring, otherwise it's something genuinely new.
    if (nearTo && nearness >= NEAR_AT) return { lane: 'explore', reason: { kind: 'near', artistId: nearTo.id }, nearness };
    return { lane: 'discover', reason: { kind: 'unknown' }, nearness };
  }
  if ((taste[artist.id] ?? 0) >= PERSONAL_AT) return { lane: 'personal', reason: { kind: 'match' }, nearness };
  if (nearTo && nearness >= NEAR_AT) return { lane: 'explore', reason: { kind: 'near', artistId: nearTo.id }, nearness };
  return { lane: 'discover', reason: { kind: 'new-sound' }, nearness };
}

/**
 * Per artist: whether you've reacted to them at all (`touched`), and your
 * likes, saves and loves minus your skips and "not for me"s (`net`).
 */
function tally(clips: Clip[], reactions: Record<string, Reaction>, ratings: Ratings) {
  const touched = new Set<string>();
  const net: Record<string, number> = {};
  for (const c of clips) {
    const r = reactions[c.id];
    if (!r) continue;
    if (r.liked || r.saved || r.skipped || r.watched) touched.add(c.artistId);
    net[c.artistId] = (net[c.artistId] ?? 0) + (r.liked ? 1 : 0) + (r.saved ? 1 : 0) - (r.skipped ? 1 : 0);
  }
  for (const [id, rating] of Object.entries(ratings)) {
    // Loving an artist must never cost them the "new to you" nudge; only turning them down does.
    if (isCold(rating)) touched.add(id);
    net[id] = (net[id] ?? 0) + RATING_NET[rating];
  }
  return { touched, net };
}

/** Every clip, scored and placed in a lane. Not yet in feed order. */
export function scoreClips({ clips, artists, taste, informed, reactions, seen, now, similarity, ratings = {} }: FeedInput): FeedItem[] {
  const byId = new Map(artists.map((a) => [a.id, a]));
  const anchors = anchorsOf(artists, taste, informed);
  const { touched, net } = tally(clips, reactions, ratings);

  const items: FeedItem[] = [];
  for (const clip of clips) {
    // A back to back is ranked by the artist in it you like best.
    const artist = [clip.artistId, ...partnersOf(clip)]
      .map((id) => byId.get(id))
      .filter((a): a is Artist => !!a)
      .reduce<Artist | undefined>((best, a) => (!best || (taste[a.id] ?? 0) > (taste[best.id] ?? 0) ? a : best), undefined);
    if (!artist) continue;
    const { lane, reason, nearness } = laneOf(artist, taste, anchors, informed, similarity);
    const r = reactions[clip.id];
    let score = taste[artist.id] ?? 0;
    if (lane === 'explore') score += nearness * NEAR_WEIGHT;
    if (lane === 'discover' && !touched.has(artist.id)) score += UNTOUCHED;
    if (reason.kind === 'unknown') score += UNKNOWN;
    if (r?.liked || r?.saved) score -= HAD_IT;
    const at = seen[clip.id];
    items.push({
      clip,
      lane,
      reason,
      score,
      seenRecently: at != null && now - at < RECENT_MS && now >= at,
      skipped: !!r?.skipped,
      cooled: (net[artist.id] ?? 0) < 0,
    });
  }
  return items;
}

/**
 * Lay clips out in lane turns. Within a lane the best score goes first; an
 * artist heard in the last ARTIST_GAP clips waits if anything else can go.
 */
function interleave(items: FeedItem[], recent: string[], slot: number): FeedItem[] {
  const queues: Record<Lane, FeedItem[]> = { personal: [], explore: [], discover: [] };
  for (const it of items) queues[it.lane].push(it);
  // Best score first, so a pick can stop looking early (thousands of clips once artists have several sets each).
  for (const q of Object.values(queues)) q.sort(byScore);
  const placed: Record<string, number> = {};
  for (const id of recent) placed[id] = (placed[id] ?? 0) + 1;
  const effective = (it: FeedItem) => it.score - REPEAT * (placed[it.clip.artistId] ?? 0);
  // The highest effective score, ties to the better score (byScore). A clip never counts for more than
  // its score, and the queue is in byScore order, so once a score can't beat the best so far nothing after it can.
  // 'none': no Shorts, 'only': Shorts only, 'any': either.
  const best = (q: FeedItem[], blocked: Set<string>, shorts: 'none' | 'only' | 'any' = 'any') => {
    let at = -1;
    let top = -Infinity;
    for (let i = 0; i < q.length; i++) {
      if (at >= 0 && q[i].score <= top) break;
      if (blocked.has(q[i].clip.artistId)) continue;
      if (shorts !== 'any' && isShort(q[i].clip) !== (shorts === 'only')) continue;
      const e = effective(q[i]);
      if (at < 0 || e > top) {
        at = i;
        top = e;
      }
    }
    return at;
  };

  const left: Record<string, number> = {};
  for (const it of items) left[it.clip.artistId] = (left[it.clip.artistId] ?? 0) + 1;
  // At least as many as anyone has left (it only goes down): only when it's high is "urgent" worth looking for.
  let mostLeft = Object.values(left).reduce((m, k) => Math.max(m, k), 0);

  const out: FeedItem[] = [];
  const total = items.length;
  // Clips placed since the last Short.
  let sinceShort = 0;
  let shortsLeft = items.filter((it) => isShort(it.clip)).length;
  while (out.length < total) {
    const turn = PATTERN[slot % PATTERN.length];
    let lanes = FALLBACK[turn];
    let blocked = new Set(recent.slice(-ARTIST_GAP));
    // If one artist has so many clips left that waiting would force two in a row later, they go now.
    const n = total - out.length;
    const last = recent[recent.length - 1];
    const most = Math.ceil((n - 1) / 2);
    if (mostLeft > most) mostLeft = Object.values(left).reduce((m, k) => Math.max(m, k), 0);
    const urgent = mostLeft > most ? Object.keys(left).find((id) => id !== last && left[id] > most) : undefined;
    if (urgent) {
      blocked = new Set(Object.keys(left).filter((id) => id !== urgent));
      lanes = (['personal', 'explore', 'discover'] as const).filter((l) => queues[l].some((it) => it.clip.artistId === urgent));
    }
    // First choice: the lane's turn, someone not heard just now; no Short right after another, and a Short
    // when it's their turn (SHORT_EVERY). Then other lanes. Then without the Short rule. Then anyone.
    let pick: { lane: Lane; index: number } | undefined;
    const shortTurn = urgent || !shortsLeft ? 'any' : sinceShort < SHORT_GAP ? 'none' : sinceShort >= SHORT_EVERY - 1 ? 'only' : 'any';
    for (const shorts of shortTurn === 'any' ? (['any'] as const) : ([shortTurn, 'any'] as const)) {
      for (const lane of lanes) {
        const index = best(queues[lane], blocked, shorts);
        if (index >= 0) {
          pick = { lane, index };
          break;
        }
      }
      if (pick) break;
    }
    if (!pick) {
      const lane = lanes.find((l) => queues[l].length > 0)!;
      pick = { lane, index: best(queues[lane], new Set()) };
    }
    const [it] = queues[pick.lane].splice(pick.index, 1);
    out.push(it);
    recent.push(it.clip.artistId);
    placed[it.clip.artistId] = (placed[it.clip.artistId] ?? 0) + 1;
    left[it.clip.artistId] -= 1;
    if (isShort(it.clip)) shortsLeft--;
    sinceShort = isShort(it.clip) ? 0 : sinceShort + 1;
    slot++;
  }
  return out;
}

function byScore(a: FeedItem, b: FeedItem) {
  // Ties keep the catalogue's order, so the result never depends on sort stability.
  return b.score - a.score || a.clip.id.localeCompare(b.clip.id, undefined, { numeric: true });
}

/** How recently a clip was seen: 1 just now, falling to 0 at the edge of the recent window. */
export function recency(at: number | undefined, now: number) {
  if (at == null || now < at) return 0;
  return Math.max(0, 1 - (now - at) / RECENT_MS);
}

/**
 * The feed: what's kept stays put, then clips you haven't seen lately in lane
 * turns, then ones you have (least recently seen first within their turn),
 * then the ones you skipped.
 */
export function rankFeed(input: FeedInput): FeedItem[] {
  const all = scoreClips(input);
  const byClip = new Map(all.map((it) => [it.clip.id, it]));
  const kept: FeedItem[] = [];
  for (const id of input.keep ?? []) {
    const it = byClip.get(id);
    if (it && !kept.includes(it)) kept.push(it);
  }
  const keptIds = new Set(kept.map((it) => it.clip.id));
  const others = all.filter((it) => !keptIds.has(it.clip.id));
  const rest = others.filter((it) => !isPage(it.clip));

  const recent = kept.map((it) => it.clip.artistId);
  const fresh = rest.filter((it) => !it.skipped && !it.seenRecently && !it.cooled);
  const cooled = rest.filter((it) => !it.skipped && !it.seenRecently && it.cooled);
  const stale = rest
    .filter((it) => !it.skipped && it.seenRecently)
    // The longer ago you saw it, the sooner it comes back.
    .map((it) => ({ ...it, score: it.score - RECENCY_WEIGHT * recency(input.seen[it.clip.id], input.now) }));
  const skipped = rest.filter((it) => it.skipped);

  const out = [...kept];
  out.push(...interleave(fresh, recent, out.length));
  out.push(...interleave(cooled, recent, out.length));
  out.push(...interleave(stale, recent, out.length));
  out.push(...interleave(skipped, recent, out.length));
  return withPages(out, kept.length, pagesFor(others, input));
}

/**
 * The SoundCloud cards that may show, best first: artists with a decent
 * match, or more likes, saves and loves than skips; never an artist you've
 * turned down. Fresh ones by score, then ones seen lately, then ones skipped.
 */
function pagesFor(items: FeedItem[], input: FeedInput): FeedItem[] {
  const pages = items.filter((it) => isPage(it.clip));
  if (!pages.length) return pages;
  const { net } = tally(input.clips, input.reactions, input.ratings ?? {});
  const fits = pages.filter((it) => !it.cooled && ((input.taste[it.clip.artistId] ?? 0) >= SOUNDCLOUD_MIN_MATCH || (net[it.clip.artistId] ?? 0) > 0));
  const fresh = fits.filter((it) => !it.skipped && !it.seenRecently).sort(byScore);
  const stale = fits
    .filter((it) => !it.skipped && it.seenRecently)
    .map((it) => ({ ...it, score: it.score - RECENCY_WEIGHT * recency(input.seen[it.clip.id], input.now) }))
    .sort(byScore);
  const skipped = fits.filter((it) => it.skipped).sort(byScore);
  return [...fresh, ...stale, ...skipped];
}

/**
 * SoundCloud cards set into the feed after what's kept: one after every
 * SOUNDCLOUD_EVERY - 1 other cards, never beside a card of the same artist.
 * Cards that don't fit wait for a longer feed (a later re-rank).
 */
function withPages(feed: FeedItem[], keptCount: number, pages: FeedItem[]): FeedItem[] {
  if (!pages.length) return feed;
  const out = feed.slice(0, keptCount);
  // Cards since the last SoundCloud card (or the start).
  let since = 0;
  for (const it of out) since = isPage(it.clip) ? 0 : since + 1;
  const left = [...pages];
  const place = (next: FeedItem | undefined) => {
    if (since < SOUNDCLOUD_EVERY - 1 || !left.length) return;
    const before = out[out.length - 1]?.clip.artistId;
    const i = left.findIndex((p) => p.clip.artistId !== before && p.clip.artistId !== next?.clip.artistId);
    if (i < 0) return;
    out.push(left.splice(i, 1)[0]);
    since = 0;
  };
  for (const it of feed.slice(keptCount)) {
    place(it);
    out.push(it);
    since++;
  }
  place(undefined);
  return out;
}

/** Remember that a clip was on screen. Keeps the history small: only the most recent views. */
export function markSeen(history: SeenHistory, clipId: string, now: number, limit = 500): SeenHistory {
  const next = { ...history, [clipId]: now };
  const ids = Object.keys(next);
  if (ids.length <= limit) return next;
  const keep = ids.sort((a, b) => next[b] - next[a]).slice(0, limit);
  return Object.fromEntries(keep.map((id) => [id, next[id]]));
}
