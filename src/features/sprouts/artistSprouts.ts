/**
 * Artist collectibles you've earned (called artist sprouts in the code: they
 * live in the garden and are given like sprouts). Pure. Every artist you've
 * filmed (a video in your Memories tagged with them, festival or throwback)
 * gives you their collectible; filming more of them levels it up: bronze at
 * 3 videos, silver at 6, gold at 10.
 */
import { t, tn } from '../../i18n';

export const TIER_AT = [1, 3, 6, 10] as const;
export const TIER_NAME = ['', 'Bronze', 'Silver', 'Gold'] as const;
/** The level's name, in the app's language. */
export const TIER_LABEL = ['', t('Bronze'), t('Silver'), t('Gold')] as const;
export type Tier = 0 | 1 | 2 | 3;

export type ArtistSprout = {
  artistId: string;
  /** Videos of them in your Memories. */
  videos: number;
  tier: Tier;
  /** When you first and last filmed them (ms). */
  firstAt: number;
  lastAt: number;
  /** A rare shiny one (see `shinyFor`). */
  shiny?: boolean;
};

export function tierFor(videos: number): Tier {
  if (videos >= TIER_AT[3]) return 3;
  if (videos >= TIER_AT[2]) return 2;
  if (videos >= TIER_AT[1]) return 1;
  return 0;
}

/** Videos still to film for the next level, or undefined at gold. */
export function toNextTier(videos: number): { more: number; tier: Tier } | undefined {
  const tier = tierFor(videos);
  if (tier === 3) return undefined;
  const next = (tier + 1) as Tier;
  return { more: TIER_AT[next] - videos, tier: next };
}

/** "2 more videos of them for silver", "Gold: you've filmed them 12 times". */
export function tierLine(videos: number): string {
  const next = toNextTier(videos);
  if (!next) return t('Gold: you’ve filmed them {n} times', { n: videos });
  if (next.tier === 1) return tn(next.more, '{n} more video of them for bronze', '{n} more videos of them for bronze');
  if (next.tier === 2) return tn(next.more, '{n} more video of them for silver', '{n} more videos of them for silver');
  return tn(next.more, '{n} more video of them for gold', '{n} more videos of them for gold');
}

/** "Bronze · 4 videos", "1 video". */
export function tierLabel(s: Pick<ArtistSprout, 'tier' | 'videos'>): string {
  const n = tn(s.videos, '{n} video', '{n} videos');
  return s.tier ? `${TIER_LABEL[s.tier]} · ${n}` : n;
}

/** Your artist sprouts from your memories, most filmed first (then most recent). */
export function artistSprouts(memories: readonly { artistId?: string; capturedAt: string }[], known?: (id: string) => boolean): ArtistSprout[] {
  const by = new Map<string, ArtistSprout>();
  for (const m of memories) {
    if (!m.artistId || (known && !known(m.artistId))) continue;
    const at = Date.parse(m.capturedAt);
    const time = Number.isNaN(at) ? 0 : at;
    const cur = by.get(m.artistId);
    if (cur) {
      cur.videos += 1;
      cur.firstAt = Math.min(cur.firstAt, time);
      cur.lastAt = Math.max(cur.lastAt, time);
    } else by.set(m.artistId, { artistId: m.artistId, videos: 1, tier: 0, firstAt: time, lastAt: time });
  }
  return [...by.values()].map((s) => ({ ...s, tier: tierFor(s.videos) })).sort((a, b) => b.videos - a.videos || b.lastAt - a.lastAt);
}

/** Only what counts since you last gave each artist's collectible away (filming them again earns it back). */
export function sinceGiven<M extends { artistId?: string; capturedAt: string }>(memories: readonly M[], givenAt: Readonly<Record<string, number>>): M[] {
  return memories.filter((m) => {
    const given = m.artistId ? givenAt[m.artistId] : undefined;
    return given === undefined || Date.parse(m.capturedAt) > given;
  });
}

/**
 * What's new since you last looked: an artist sprout you haven't seen, or one
 * that reached a higher level. `shown` keeps, per artist, the level last
 * celebrated plus one (0 = never seen).
 */
export function newArtistSprouts(list: readonly ArtistSprout[], shown: Record<string, number>): ArtistSprout[] {
  return list.filter((s) => (shown[s.artistId] ?? 0) < s.tier + 1);
}

export const shownMark = (s: ArtistSprout) => s.tier + 1;

/** Read back what was celebrated, dropping anything malformed. */
export function cleanShown(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw && typeof raw === 'object')
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (k.length <= 120 && typeof v === 'number' && v >= 1 && v <= 4) out[k] = Math.floor(v);
  return out;
}

/** "Artist sprouts · 4", "12 artists filmed, 2 at gold". */
export function artistGardenLine(list: readonly ArtistSprout[]): string {
  if (!list.length) return t('Film a set and that artist’s collectible joins your garden.');
  const gold = list.filter((s) => s.tier === 3).length;
  return gold
    ? tn(list.length, '{n} artist filmed, {gold} at gold', '{n} artists filmed, {gold} at gold', { gold })
    : tn(list.length, '{n} artist filmed', '{n} artists filmed');
}

/**
 * Videos you posted to Afterglow count too, once each artist: every artist
 * you've shared a video of (and anyone back to back with them) gives you
 * their collectible at its first level, even when the video isn't in this
 * phone's Memories any more (a new phone, a cleared browser) or was an old
 * one you posted. Levelling up still comes from the videos in your Memories.
 */
export function withPosted(
  list: readonly ArtistSprout[],
  posted: readonly { artistId?: string; withArtistIds?: readonly string[]; capturedAt: string }[],
  known?: (id: string) => boolean,
): ArtistSprout[] {
  const have = new Set(list.map((a) => a.artistId));
  const extra = new Map<string, ArtistSprout>();
  for (const m of posted) {
    const at = Date.parse(m.capturedAt);
    const time = Number.isNaN(at) ? 0 : at;
    for (const id of [m.artistId, ...(m.artistId ? (m.withArtistIds ?? []) : [])]) {
      if (!id || have.has(id) || (known && !known(id))) continue;
      const cur = extra.get(id);
      if (cur) {
        cur.firstAt = Math.min(cur.firstAt, time);
        cur.lastAt = Math.max(cur.lastAt, time);
      } else extra.set(id, { artistId: id, videos: 1, tier: 0, firstAt: time, lastAt: time });
    }
  }
  return [...list, ...[...extra.values()].sort((a, b) => b.lastAt - a.lastAt)];
}
