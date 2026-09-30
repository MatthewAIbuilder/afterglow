import type { Clip, Festival } from '../../data/models';
import type { SharedMemory } from '../social/models';

/**
 * Community clips: memories people shared to their profiles, shown in
 * Discover beside the official clips. Pure.
 *
 * Only shared memories tagged with an artist Afterglow knows become clips
 * (the feed ranks by artist). Anything from someone you blocked, or that you
 * reported or hid, never shows, and neither do your own. For a festival, only clips tagged with that
 * festival and an artist on its lineup.
 */
export const COMMUNITY_PREFIX = 'community:';
/** At most this many community clips in one feed, newest first. */
export const COMMUNITY_MAX = 40;
/** A community clip with no length recorded is treated as this long. */
const DEFAULT_SEC = 30;

export const isCommunityClip = (clip: Clip) => clip.source?.provider === 'community';
export const communityClipId = (sharedId: string) => `${COMMUNITY_PREFIX}${sharedId}`;

const HTTPS = /^https:\/\//;

/** One shared memory as a feed clip, or undefined when it can't be one. */
export function communityClip(m: SharedMemory, artists: ReadonlySet<string>): Clip | undefined {
  if (!m.artistId || !artists.has(m.artistId) || !m.festivalId || !HTTPS.test(m.videoUrl) || !m.handle) return undefined;
  const sec = m.durationSec && m.durationSec > 0 ? Math.min(180, Math.round(m.durationSec)) : DEFAULT_SEC;
  // Phones film upright unless the size says otherwise.
  const vertical = m.width && m.height ? m.height >= m.width : true;
  return {
    id: communityClipId(m.id),
    artistId: m.artistId,
    festivalId: m.festivalId,
    title: 'From the crowd',
    durationSec: sec,
    bpm: 0,
    source: {
      provider: 'community',
      videoUrl: m.videoUrl,
      thumbUrl: m.thumbUrl && HTTPS.test(m.thumbUrl) ? m.thumbUrl : undefined,
      handle: m.handle,
      uid: m.uid,
      sharedId: m.id,
      capturedAt: m.capturedAt,
      vertical,
    },
  };
}

export type CommunityFilter = {
  /** Afterglow's artists. */
  artists: ReadonlySet<string>;
  /** People you blocked. */
  blocked: ReadonlySet<string>;
  /** Shared memories you reported or hid. */
  hidden: ReadonlySet<string>;
  /** You: your own shared videos are in Memories, not your feed (and liking them shouldn't shape your taste). */
  me?: string;
  /** A festival in focus: only its clips, of artists on its lineup. Undefined for your mix. */
  festival?: Festival;
};

/** The shared memories that may show, as clips, newest first, one each, at most COMMUNITY_MAX. */
export function communityClips(memories: SharedMemory[], f: CommunityFilter): Clip[] {
  const lineup = f.festival ? new Set(f.festival.lineup) : undefined;
  const seen = new Set<string>();
  const out: Clip[] = [];
  const newest = [...memories].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const m of newest) {
    if (seen.has(m.id) || f.blocked.has(m.uid) || f.hidden.has(m.id) || m.uid === f.me) continue;
    if (f.festival && (m.festivalId !== f.festival.id || !lineup!.has(m.artistId ?? ''))) continue;
    const clip = communityClip(m, f.artists);
    if (!clip) continue;
    seen.add(m.id);
    out.push(clip);
    if (out.length >= COMMUNITY_MAX) break;
  }
  return out;
}

/**
 * Stand-ins for community clips you reacted to that aren't loaded right now,
 * so your likes, skips and watching still count for the artist after the
 * clip has left the feed. Only the id and artist matter to the taste engine.
 */
export function rememberedClips(reactionIds: Iterable<string>, artistOf: Record<string, string>, loaded: ReadonlySet<string>): Clip[] {
  const out: Clip[] = [];
  for (const id of reactionIds) {
    const artistId = artistOf[id];
    if (!artistId || loaded.has(id) || !id.startsWith(COMMUNITY_PREFIX)) continue;
    out.push({ id, artistId, festivalId: '', title: '', durationSec: DEFAULT_SEC, bpm: 0 });
  }
  return out;
}

/** Remembered artists, newest last, bounded so the list can't grow forever. */
export const ARTIST_MEMORY_MAX = 500;
export function rememberArtist(artistOf: Record<string, string>, clipId: string, artistId: string): Record<string, string> {
  if (artistOf[clipId] === artistId) return artistOf;
  const next = { ...artistOf };
  delete next[clipId];
  next[clipId] = artistId;
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - ARTIST_MEMORY_MAX))) delete next[k];
  return next;
}
