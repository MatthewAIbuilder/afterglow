/**
 * The song playing in a video ("track ID"), found by Shazam on the phone
 * (`lib/shazam.ts`) and kept only once the person who filmed it says it's
 * right. Shown on the video wherever it's shared. It names the song's own
 * artist, who often isn't the DJ playing it, so it never replaces "who's
 * playing". Pure.
 */
export type Track = {
  title: string;
  /** The song's artist (as Shazam names them), not necessarily who was playing. */
  artist: string;
  /** The song on Apple Music, when Shazam knows it. */
  appleMusicUrl?: string;
};

/** The longest song title or artist kept. */
export const TRACK_TEXT_MAX = 120;
const APPLE_MUSIC = /^https:\/\/music\.apple\.com\/[A-Za-z0-9/_.%?=&:-]{1,280}$/;

const text = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, TRACK_TEXT_MAX) : '');

/** A track read back (from the phone, the database or Shazam), checked: a title and an artist, or nothing. */
export function cleanTrack(raw: unknown): Track | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const title = text(o.title);
  const artist = text(o.artist);
  if (!title || !artist) return undefined;
  const url = typeof o.appleMusicUrl === 'string' && APPLE_MUSIC.test(o.appleMusicUrl) ? o.appleMusicUrl : undefined;
  return { title, artist, ...(url ? { appleMusicUrl: url } : {}) };
}

/** What Shazam answered for a video: a track when it found one, otherwise why not. */
export type TrackSearch = { found: Track } | { found?: undefined; reason: 'none' | 'unsupported' | 'failed' };

export function readTrackSearch(answer: unknown): TrackSearch {
  const o = answer && typeof answer === 'object' ? (answer as Record<string, unknown>) : {};
  if (o.status === 'match') {
    const found = cleanTrack(o);
    return found ? { found } : { reason: 'none' };
  }
  return { reason: o.status === 'none' ? 'none' : o.status === 'unsupported' ? 'unsupported' : 'failed' };
}

/** Same song? (Shazam's own spelling, ignoring case.) */
export const sameTrack = (a: Track | undefined, b: Track | undefined) =>
  !!a && !!b && a.title.toLowerCase() === b.title.toLowerCase() && a.artist.toLowerCase() === b.artist.toLowerCase();

/** The database keeps a track as three plain fields on the shared video. */
export function trackFields(track: Track | undefined): { trackTitle?: string; trackArtist?: string; trackUrl?: string } {
  const t = cleanTrack(track);
  return t ? { trackTitle: t.title, trackArtist: t.artist, ...(t.appleMusicUrl ? { trackUrl: t.appleMusicUrl } : {}) } : {};
}

export function trackFromFields(o: Record<string, unknown>): Track | undefined {
  return cleanTrack({ title: o.trackTitle, artist: o.trackArtist, appleMusicUrl: o.trackUrl });
}

/**
 * The song's artist when they're on Afterglow (the first name of a
 * collaboration: "Fred again.. & Skrillex" finds Fred again..), so you can
 * tag them as who was playing if it was their own set. Pure.
 */
export function trackArtistOn<A extends { id: string; name: string }>(track: Track | undefined, artists: readonly A[], fold: (s: string) => string): A | undefined {
  if (!track) return undefined;
  const names = track.artist.split(/\s*(?:,|&|\+|\bx\b|\bfeat\.?|\bft\.?|\bwith\b)\s*/i).map(fold).filter(Boolean);
  for (const n of names) {
    const hit = artists.find((a) => fold(a.name) === n);
    if (hit) return hit;
  }
  return undefined;
}
