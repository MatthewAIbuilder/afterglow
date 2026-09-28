import type { Artist, Clip, TasteProfile } from '../../data/types';
import type { Reaction } from '../../state/reactions';
import { soundSimilarity } from '../sound-map/layout';

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
 * artist twice in a row when it can avoid it, and gives each artist one clip
 * before anyone gets a second. Order of blocks: fresh clips, then clips of
 * artists you've turned down (more skips than likes and saves), then clips
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
): { lane: Lane; reason: Reason; nearness: number } {
  let nearness = 0;
  let nearTo: Artist | undefined;
  for (const a of anchors) {
    if (a.id === artist.id) continue;
    const s = soundSimilarity(artist, a);
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

/** Every clip, scored and placed in a lane. Not yet in feed order. */
export function scoreClips({ clips, artists, taste, informed, reactions, seen, now }: FeedInput): FeedItem[] {
  const byId = new Map(artists.map((a) => [a.id, a]));
  const anchors = anchorsOf(artists, taste, informed);
  const touched = new Set<string>();
  const net: Record<string, number> = {};
  for (const c of clips) {
    const r = reactions[c.id];
    if (!r) continue;
    if (r.liked || r.saved || r.skipped || r.watched) touched.add(c.artistId);
    net[c.artistId] = (net[c.artistId] ?? 0) + (r.liked ? 1 : 0) + (r.saved ? 1 : 0) - (r.skipped ? 1 : 0);
  }

  const items: FeedItem[] = [];
  for (const clip of clips) {
    const artist = byId.get(clip.artistId);
    if (!artist) continue;
    const { lane, reason, nearness } = laneOf(artist, taste, anchors, informed);
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
  const placed: Record<string, number> = {};
  for (const id of recent) placed[id] = (placed[id] ?? 0) + 1;
  const effective = (it: FeedItem) => it.score - REPEAT * (placed[it.clip.artistId] ?? 0);
  const best = (q: FeedItem[], blocked: Set<string>) => {
    let at = -1;
    for (let i = 0; i < q.length; i++) {
      if (blocked.has(q[i].clip.artistId)) continue;
      if (at < 0 || effective(q[i]) > effective(q[at]) || (effective(q[i]) === effective(q[at]) && byScore(q[i], q[at]) < 0)) at = i;
    }
    return at;
  };

  const left: Record<string, number> = {};
  for (const it of items) left[it.clip.artistId] = (left[it.clip.artistId] ?? 0) + 1;

  const out: FeedItem[] = [];
  const total = items.length;
  while (out.length < total) {
    const turn = PATTERN[slot % PATTERN.length];
    let lanes = FALLBACK[turn];
    let blocked = new Set(recent.slice(-ARTIST_GAP));
    // If one artist has so many clips left that waiting would force two in a row later, they go now.
    const n = total - out.length;
    const last = recent[recent.length - 1];
    const urgent = Object.keys(left).find((id) => id !== last && left[id] > Math.ceil((n - 1) / 2));
    if (urgent) {
      blocked = new Set(Object.keys(left).filter((id) => id !== urgent));
      lanes = (['personal', 'explore', 'discover'] as const).filter((l) => queues[l].some((it) => it.clip.artistId === urgent));
    }
    // First choice: the lane's turn, someone not heard just now. Then other lanes. Then anyone.
    let pick: { lane: Lane; index: number } | undefined;
    for (const lane of lanes) {
      const index = best(queues[lane], blocked);
      if (index >= 0) {
        pick = { lane, index };
        break;
      }
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
  const rest = all.filter((it) => !keptIds.has(it.clip.id));

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
