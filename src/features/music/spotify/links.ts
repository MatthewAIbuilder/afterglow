import type { SpotifyLibrary, SpotifySavedTrack } from './normalize';

/**
 * Spotify without signing in: you paste a link to a public playlist (or an
 * album or artist) from Spotify's Share → Copy link, and Afterglow reads its
 * songs from Spotify's public embed page, the same page any website shows
 * when it embeds that playlist. No account, no key, nothing sent to Spotify
 * but the link. Pure, except `readSpotifyLink`, which is handed its fetch.
 */
export type SpotifyLinkKind = 'playlist' | 'album' | 'artist';
export type SpotifyLink = { kind: SpotifyLinkKind; id: string };

/** At most this many links are kept (each is read on every sync). */
export const SPOTIFY_LINKS_MAX = 10;

const KINDS: readonly SpotifyLinkKind[] = ['playlist', 'album', 'artist'];
const ID = /^[A-Za-z0-9]{10,40}$/;

/**
 * A pasted link as a playlist, album or artist: open.spotify.com links (with
 * a language part like /intl-es/ and ?si=…), and spotify:playlist:… URIs.
 * Short spotify.link addresses are `short`: they're opened first to see where
 * they lead. Anything else is undefined.
 */
export function parseSpotifyLink(raw: string): SpotifyLink | { short: string } | undefined {
  const text = raw.trim();
  // Shared text can carry words around the link ("Check this out https://…").
  const url = text.match(/https?:\/\/[^\s]+/)?.[0] ?? text;
  const uri = url.match(/^spotify:(playlist|album|artist):([A-Za-z0-9]+)$/);
  if (uri && ID.test(uri[2])) return { kind: uri[1] as SpotifyLinkKind, id: uri[2] };
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return undefined;
  }
  const host = u.hostname.toLowerCase();
  if (host === 'spotify.link' || host.endsWith('.app.link')) return /^https:\/\//.test(url) ? { short: url } : undefined;
  if (host !== 'open.spotify.com' && host !== 'play.spotify.com') return undefined;
  const parts = u.pathname.split('/').filter(Boolean);
  // /playlist/<id>, /intl-es/playlist/<id>, /embed/playlist/<id>, /user/<name>/playlist/<id>
  for (let i = 0; i < parts.length - 1; i++) {
    const kind = parts[i] as SpotifyLinkKind;
    if (KINDS.includes(kind) && ID.test(parts[i + 1])) return { kind, id: parts[i + 1] };
  }
  return undefined;
}

export const embedUrl = (l: SpotifyLink) => `https://open.spotify.com/embed/${l.kind}/${l.id}`;
export const sameLink = (a: SpotifyLink, b: SpotifyLink) => a.kind === b.kind && a.id === b.id;

/** One song on the embed page: its title and artists. */
export type EmbedTrack = { id?: string; title: string; artists: string[] };
export type EmbedReading = { name?: string; tracks: EmbedTrack[] };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** The artists of one track on the page: an `artists` list of names when there is one, else the "A, B" line under the title. */
function artistsOf(t: Record<string, unknown>): string[] {
  if (Array.isArray(t.artists)) {
    const names = t.artists.map((a) => (isObj(a) ? str(a.name) : str(a))).filter((n): n is string => !!n);
    if (names.length) return names;
  }
  const line = str(t.subtitle);
  return line
    ? line
        .split(/,\s+|\s+&\s+/)
        .map((s) => s.replace(/ /g, ' ').trim())
        .filter(Boolean)
    : [];
}

/** The first object anywhere in `data` that has a list of tracks, with its name. */
function findTrackList(data: unknown, depth = 0): { name?: string; list: unknown[] } | undefined {
  if (depth > 12) return undefined;
  if (Array.isArray(data)) {
    for (const x of data) {
      const found = findTrackList(x, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (!isObj(data)) return undefined;
  if (Array.isArray(data.trackList) && data.trackList.length) return { name: str(data.name) ?? str(data.title), list: data.trackList };
  for (const v of Object.values(data)) {
    const found = findTrackList(v, depth + 1);
    if (found) return found;
  }
  return undefined;
}

/**
 * The songs on a Spotify embed page: the page's own data (a JSON script tag,
 * usually `__NEXT_DATA__`), its track list. Undefined when the page has none
 * (private, removed, or Spotify changed the page).
 */
export function readEmbedPage(html: string): EmbedReading | undefined {
  const scripts = html.matchAll(/<script\b[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g);
  for (const m of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const found = findTrackList(data);
    if (!found) continue;
    const tracks = found.list.flatMap((x): EmbedTrack[] => {
      if (!isObj(x)) return [];
      const title = str(x.title) ?? str(x.name);
      const artists = artistsOf(x);
      if (!title || !artists.length) return [];
      const uri = str(x.uri);
      return [{ ...(uri ? { id: uri } : {}), title, artists }];
    });
    if (tracks.length) return { ...(found.name ? { name: found.name } : {}), tracks };
  }
  return undefined;
}

/**
 * Songs from every link as a Spotify library of "saved" songs (each artist
 * counted once per song, however many links have it), for `normalizeSpotify`.
 * Playlists say nothing about who you follow or play most, so nothing is
 * listed as missing either.
 */
export function libraryFromEmbeds(readings: readonly EmbedReading[]): SpotifyLibrary {
  const seen = new Set<string>();
  const saved: SpotifySavedTrack[] = [];
  for (const r of readings)
    for (const t of r.tracks) {
      const key = t.id ?? `${t.title}|${t.artists.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      saved.push({ track: { id: key, name: t.title, artists: t.artists.map((name) => ({ name })) } });
    }
  return { saved, followed: [], top: [], recent: [], gaps: [] };
}

export type TextFetch = (url: string) => Promise<{ ok: boolean; status: number; url?: string; text: () => Promise<string> }>;

export type LinkProblem = 'bad-link' | 'not-public' | 'network';

/** Where a short spotify.link address leads. */
export async function resolveShortLink(fetchText: TextFetch, short: string): Promise<SpotifyLink | LinkProblem> {
  let res: Awaited<ReturnType<TextFetch>>;
  try {
    res = await fetchText(short);
  } catch {
    return 'network';
  }
  const landed = res.url ? parseSpotifyLink(res.url) : undefined;
  if (landed && !('short' in landed)) return landed;
  // Some short links answer with a page that points on to open.spotify.com.
  const body = res.ok ? await res.text().catch(() => '') : '';
  const inside = body.match(/https:\/\/open\.spotify\.com\/[^"'\s<>]+/)?.[0];
  const next = inside ? parseSpotifyLink(inside) : undefined;
  return next && !('short' in next) ? next : 'bad-link';
}

/** One link's songs, from its embed page. */
export async function readSpotifyLink(fetchText: TextFetch, link: SpotifyLink): Promise<EmbedReading | LinkProblem> {
  let res: Awaited<ReturnType<TextFetch>>;
  try {
    res = await fetchText(embedUrl(link));
  } catch {
    return 'network';
  }
  if (res.status === 404 || res.status === 403) return 'not-public';
  if (!res.ok) return 'network';
  let html: string;
  try {
    html = await res.text();
  } catch {
    return 'network';
  }
  return readEmbedPage(html) ?? 'not-public';
}
