import type { Clip, CommunityClipSource, Festival } from '../../data/models';
import type { SharedMemory } from '../social/models';
import { pastKey, pastLabel } from '../memories/past';
import { showKey, showLabel } from '../memories/show';
import { t } from '../../i18n';

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
/** A community clip from a one-night show is filed under this, plus the show's key, instead of a festival id. */
export const SHOW_PREFIX = 'show:';
/** At most this many community clips in one feed, newest first. */
export const COMMUNITY_MAX = 40;
/** A community clip with no length recorded is treated as this long. */
const DEFAULT_SEC = 30;

export const isCommunityClip = (clip: Clip) => clip.source?.provider === 'community';
export const communityClipId = (sharedId: string) => `${COMMUNITY_PREFIX}${sharedId}`;

const HTTPS = /^https:\/\//;

/** One shared memory as a feed clip, or undefined when it can't be one. */
export function communityClip(m: SharedMemory, artists: ReadonlySet<string>): Clip | undefined {
  // A throwback (a past festival) belongs with the same festival on Afterglow when there is one; a one-night show
  // has its own key, and a video from neither still shows for its artist.
  const festivalId = m.festivalId ?? m.past?.seriesId ?? (m.past ? `past:${pastKey(m.past)}` : m.show ? `${SHOW_PREFIX}${showKey(m.show)}` : '');
  if (!m.artistId || !artists.has(m.artistId) || !HTTPS.test(m.videoUrl) || !m.handle) return undefined;
  // A trimmed video is as long as the part that plays.
  const length = m.clip ? m.clip.end - m.clip.start : m.durationSec;
  const sec = length && length > 0 ? Math.min(180, Math.round(length)) : DEFAULT_SEC;
  // Phones film upright unless the size says otherwise.
  const vertical = m.width && m.height ? m.height >= m.width : true;
  return {
    id: communityClipId(m.id),
    artistId: m.artistId,
    festivalId,
    title: m.festivalId ? 'From the crowd' : m.past ? `Throwback · ${pastLabel(m.past)}` : m.show ? `From the crowd · ${showLabel(m.show)}` : 'From the crowd',
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
      ...(m.clip ? { clip: m.clip } : {}),
      ...(m.withArtistIds?.length ? { withArtistIds: m.withArtistIds } : {}),
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
    // A festival's own videos, and throwbacks from its earlier years, of artists on its lineup.
    const here = m.festivalId === f.festival?.id || (!m.festivalId && m.past?.seriesId === f.festival?.id);
    if (f.festival && (!here || !lineup!.has(m.artistId ?? ''))) continue;
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
    // "main|other": a back to back remembers everyone playing.
    const [artistId, ...others] = (artistOf[id] ?? '').split(PLAYERS_JOIN).filter(Boolean);
    if (!artistId || loaded.has(id) || !id.startsWith(COMMUNITY_PREFIX)) continue;
    out.push({ id, artistId, festivalId: '', title: '', durationSec: DEFAULT_SEC, bpm: 0, ...(others.length ? { withArtistIds: others } : {}) });
  }
  return out;
}

/** Joins the artists remembered for a back to back ("boogie-t|subtronics"); ids never contain it. */
export const PLAYERS_JOIN = '|';

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

/**
 * Community clips you liked, kept whole on the phone so Your clips can list
 * and play them after they've left the feed. Newest last, at most KEPT_MAX.
 */
export const KEPT_MAX = 200;
export function keepClip(kept: Record<string, Clip>, clip: Clip): Record<string, Clip> {
  if (!isCommunityClip(clip) || kept[clip.id] === clip) return kept;
  const next = { ...kept };
  delete next[clip.id];
  next[clip.id] = clip;
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - KEPT_MAX))) delete next[k];
  return next;
}

/** Kept clips read back from storage: anything that isn't a well-formed community clip is dropped. */
export function cleanKept(raw: unknown): Record<string, Clip> {
  const out: Record<string, Clip> = {};
  if (!raw || typeof raw !== 'object') return out;
  const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const c = v as Partial<Clip> | null;
    const s = c?.source as Partial<CommunityClipSource> | undefined;
    if (!c || !id.startsWith(COMMUNITY_PREFIX) || c.id !== id || !str(c.artistId) || !str(c.festivalId)) continue;
    if (!s || s.provider !== 'community' || !str(s.videoUrl) || !HTTPS.test(s.videoUrl) || !str(s.handle) || !str(s.uid) || !str(s.sharedId)) continue;
    const sec = typeof c.durationSec === 'number' && c.durationSec > 0 ? Math.min(180, c.durationSec) : DEFAULT_SEC;
    out[id] = {
      id,
      artistId: c.artistId,
      festivalId: c.festivalId,
      title: str(c.title) ? c.title : 'From the crowd',
      durationSec: sec,
      bpm: 0,
      source: {
        provider: 'community',
        videoUrl: s.videoUrl,
        thumbUrl: str(s.thumbUrl) && HTTPS.test(s.thumbUrl) ? s.thumbUrl : undefined,
        handle: s.handle,
        uid: s.uid,
        sharedId: s.sharedId,
        capturedAt: str(s.capturedAt) ? s.capturedAt : '',
        vertical: s.vertical !== false,
      },
    };
  }
  return out;
}

/** Kept clips that may still show: an artist Afterglow knows, nobody you blocked, nothing you hid. */
export function keptClips(kept: Record<string, Clip>, f: Pick<CommunityFilter, 'artists' | 'blocked' | 'hidden'>): Clip[] {
  return Object.values(kept).filter((c) => {
    const s = c.source;
    return s?.provider === 'community' && f.artists.has(c.artistId) && !f.blocked.has(s.uid) && !f.hidden.has(s.sharedId);
  });
}

/**
 * A crowd clip's title as shown: the two titles the app makes ("From the
 * crowd", "Throwback · {festival}") are kept in English with the clip (and in
 * reports to support), so they're translated here, at display. Any other
 * title (a video's own) is shown as it is.
 */
export function shownClipTitle(title: string): string {
  if (title === 'From the crowd') return t('From the crowd');
  const throwback = /^Throwback · (.+)$/.exec(title);
  if (throwback) return t('Throwback · {festival}', { festival: throwback[1] });
  const show = /^From the crowd · (.+)$/.exec(title);
  return show ? t('From the crowd · {show}', { show: show[1] }) : title;
}
