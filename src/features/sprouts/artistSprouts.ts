/**
 * Artist sprouts you've earned. Pure. Every artist you've filmed (a video in
 * your Memories tagged with them, festival or throwback) gives you their
 * sprout; filming more of them levels it up: bronze at 3 videos, silver at
 * 6, gold at 10.
 */
export const TIER_AT = [1, 3, 6, 10] as const;
export const TIER_NAME = ['', 'Bronze', 'Silver', 'Gold'] as const;
export type Tier = 0 | 1 | 2 | 3;

export type ArtistSprout = {
  artistId: string;
  /** Videos of them in your Memories. */
  videos: number;
  tier: Tier;
  /** When you first and last filmed them (ms). */
  firstAt: number;
  lastAt: number;
};

export function tierFor(videos: number): Tier {
  if (videos >= TIER_AT[3]) return 3;
  if (videos >= TIER_AT[2]) return 2;
  if (videos >= TIER_AT[1]) return 1;
  return 0;
}

/** Videos still to film for the next level, or undefined at gold. */
export function toNextTier(videos: number): { more: number; tier: Tier } | undefined {
  const t = tierFor(videos);
  if (t === 3) return undefined;
  const next = (t + 1) as Tier;
  return { more: TIER_AT[next] - videos, tier: next };
}

/** "2 more videos of them for silver", "Gold: you've filmed them 12 times". */
export function tierLine(videos: number): string {
  const next = toNextTier(videos);
  if (!next) return `Gold: you’ve filmed them ${videos} times`;
  return `${next.more} more ${next.more === 1 ? 'video' : 'videos'} of them for ${TIER_NAME[next.tier].toLowerCase()}`;
}

/** "Bronze · 4 videos", "1 video". */
export function tierLabel(s: Pick<ArtistSprout, 'tier' | 'videos'>): string {
  const n = `${s.videos} ${s.videos === 1 ? 'video' : 'videos'}`;
  return s.tier ? `${TIER_NAME[s.tier]} · ${n}` : n;
}

/** Your artist sprouts from your memories, most filmed first (then most recent). */
export function artistSprouts(memories: readonly { artistId?: string; capturedAt: string }[], known?: (id: string) => boolean): ArtistSprout[] {
  const by = new Map<string, ArtistSprout>();
  for (const m of memories) {
    if (!m.artistId || (known && !known(m.artistId))) continue;
    const at = Date.parse(m.capturedAt);
    const t = Number.isNaN(at) ? 0 : at;
    const cur = by.get(m.artistId);
    if (cur) {
      cur.videos += 1;
      cur.firstAt = Math.min(cur.firstAt, t);
      cur.lastAt = Math.max(cur.lastAt, t);
    } else by.set(m.artistId, { artistId: m.artistId, videos: 1, tier: 0, firstAt: t, lastAt: t });
  }
  return [...by.values()].map((s) => ({ ...s, tier: tierFor(s.videos) })).sort((a, b) => b.videos - a.videos || b.lastAt - a.lastAt);
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
  if (!list.length) return 'Film a set and that artist’s sprout grows in your garden.';
  const gold = list.filter((s) => s.tier === 3).length;
  return `${list.length} ${list.length === 1 ? 'artist' : 'artists'} filmed${gold ? `, ${gold} at gold` : ''}`;
}
