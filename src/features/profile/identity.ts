import { SOUND_LABEL, type Artist, type SoundTag } from '../../data/models';
import { type Rating, isCold } from '../taste/ratings';
import { toShares, type SoundShare } from '../taste/lean';

/**
 * Your Afterglow identity, from what the phone already knows: the artists
 * that orbit your photo, the row of artists you love, and the sound you've
 * been feeling this week. Pure.
 */

/** How many artists drift around your photo, and how many show in Your artists. */
export const ORBIT_MAX = 6;
export const FAVOURITES_MAX = 12;
/** A match this good counts as a favourite even without a rating. */
export const FAVOURITE_MATCH = 0.75;
/** "Currently feeling" looks this far back, and needs this many clips you enjoyed. */
export const FEELING_DAYS = 7;
export const FEELING_MIN_CLIPS = 2;

export type Favourite = { artist: Artist; match: number; why: 'love' | 'like' | 'follow' | 'match' };

type FavouriteInput = {
  artists: readonly Artist[];
  taste: Record<string, number>;
  informed: Record<string, boolean>;
  ratings: Record<string, Rating>;
  followed: readonly string[];
};

const BONUS: Record<Favourite['why'], number> = { love: 3, like: 2, follow: 1, match: 0 };

/**
 * The artists you love most, best first: ones you love, then like, then
 * follow, then strong matches the app has real signal for, each ordered by
 * match. Never anyone you turned down.
 */
export function favouriteArtists({ artists, taste, informed, ratings, followed }: FavouriteInput, max = FAVOURITES_MAX): Favourite[] {
  const follows = new Set(followed);
  const out: Favourite[] = [];
  for (const artist of artists) {
    const r = ratings[artist.id];
    if (isCold(r)) continue;
    const match = taste[artist.id] ?? 0;
    const why: Favourite['why'] | undefined =
      r === 'love' ? 'love' : r === 'like' ? 'like' : follows.has(artist.id) ? 'follow' : informed[artist.id] && match >= FAVOURITE_MATCH ? 'match' : undefined;
    if (why) out.push({ artist, match, why });
  }
  return out.sort((a, b) => BONUS[b.why] + b.match - (BONUS[a.why] + a.match) || a.artist.name.localeCompare(b.artist.name)).slice(0, max);
}

export type OrbitPlace = { x: number; y: number; size: number; delay: number };

/**
 * Where each artist sits around your photo, centre (0, 0): evenly round an
 * ellipse starting top right, the best match biggest, every other one a
 * little further in so the ring has depth.
 */
export function orbitPlaces(n: number, rx: number, ry: number, big = 48, small = 30): OrbitPlace[] {
  const out: OrbitPlace[] = [];
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 3 + (i * 2 * Math.PI) / n;
    const depth = i % 2 ? 0.86 : 1;
    const size = Math.round(big - ((big - small) * i) / Math.max(1, n - 1));
    out.push({ x: Math.round(Math.cos(angle) * rx * depth), y: Math.round(Math.sin(angle) * ry * depth), size, delay: i * 120 });
  }
  return out;
}

type FeelingInput = {
  /** Clip -> when it was last on screen (ms). */
  seen: Record<string, number>;
  reactions: Record<string, { liked?: boolean; saved?: boolean; skipped?: boolean; watched?: string } | undefined>;
  artistOfClip: (clipId: string) => Artist | undefined;
  now: number;
};

const WATCH_WEIGHT: Record<string, number> = { through: 0.3, replayed: 0.5 };

/**
 * The sound you've been feeling lately: clips on screen in the last week
 * that you liked, saved or watched through, weighed like the taste engine
 * weighs them. Undefined until there are a couple of them.
 */
export function currentlyFeeling({ seen, reactions, artistOfClip, now }: FeelingInput): SoundShare | undefined {
  const since = now - FEELING_DAYS * 86_400_000;
  const pull: Partial<Record<SoundTag, number>> = {};
  let clips = 0;
  for (const [clipId, at] of Object.entries(seen)) {
    if (at < since) continue;
    const r = reactions[clipId];
    if (!r || r.skipped) continue;
    const w = (r.saved ? 1.3 : r.liked ? 1 : 0) || WATCH_WEIGHT[r.watched ?? ''] || 0;
    const artist = artistOfClip(clipId);
    if (!w || !artist) continue;
    let carried = false;
    for (const [tag, amount] of Object.entries(artist.sound) as [SoundTag, number][]) {
      if (!amount) continue;
      pull[tag] = (pull[tag] ?? 0) + w * amount;
      carried = true;
    }
    if (carried) clips += 1;
  }
  if (clips < FEELING_MIN_CLIPS) return undefined;
  return toShares(pull)[0];
}

/** "Currently feeling melodic bass". */
export const feelingLine = (tag: SoundTag) => `Currently feeling ${SOUND_LABEL[tag].toLowerCase()}`;
