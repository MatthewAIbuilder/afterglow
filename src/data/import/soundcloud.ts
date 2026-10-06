import { b2bParts } from '../members';
import type { SoundCloudProfile } from '../models';
import { fold } from './edmtrain';

/**
 * Artists' own SoundCloud pages, matched each night by name (the owner chose
 * this on 2026-10-06: automatic, no developer key). The nightly job
 * (scripts/soundcloud-artists.ts) tries a few likely page links built from
 * the name and asks SoundCloud's public oEmbed endpoint about each; a page
 * counts only when the name SoundCloud gives for it is the artist's name
 * exactly (letters and digits, accents and case ignored). Results are kept in
 * the hosted catalogue between nights ("soundcloud"), and misses are retried
 * after RETRY_MISSES_DAYS ("soundcloudMisses"). A link set by hand in the
 * catalogue (the artist's "soundcloud") always wins and is never looked up.
 * Pure: the job does the fetching.
 */

/** Most oEmbed requests in one night; the rest wait for the next night. */
export const MAX_REQUESTS = 150;
/** Most page links tried per artist. */
export const MAX_CANDIDATES = 3;
/** An artist whose pages weren't found is asked again after this many days. */
export const RETRY_MISSES_DAYS = 30;
/** Longest link, name and picture link kept. */
const MAX_URL = 200;
const MAX_NAME = 120;
const MAX_IMAGE = 500;

/** A SoundCloud page link: soundcloud.com, then one to three parts of letters, digits, "-" and "_". */
const PAGE = /^https:\/\/(?:www\.|m\.)?soundcloud\.com\/([A-Za-z0-9_-]{1,100}(?:\/[A-Za-z0-9_-]{1,100}){0,2})\/?$/;
/** SoundCloud's pictures come from its image servers. */
const IMAGE = /^https:\/\/[a-z0-9-]+\.sndcdn\.com\/[^\s"'<>]+$/i;

/** "https://soundcloud.com/<page>" for a SoundCloud page link (www. and m. dropped, no trailing slash), else undefined. */
export function soundcloudUrl(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (s.length > MAX_URL) return undefined;
  const m = PAGE.exec(s);
  return m ? `https://soundcloud.com/${m[1]}` : undefined;
}

/** A SoundCloud picture link (https, on sndcdn.com), else undefined. */
export function soundcloudImage(v: unknown): string | undefined {
  return typeof v === 'string' && v.length <= MAX_IMAGE && IMAGE.test(v) ? v : undefined;
}

/** A profile as read from a file: a valid page link, and a name and picture only when they look right. */
export function soundcloudProfile(v: unknown): SoundCloudProfile | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const r = v as Record<string, unknown>;
  const url = soundcloudUrl(r.url);
  if (!url) return undefined;
  const out: SoundCloudProfile = { url };
  if (typeof r.name === 'string' && r.name.trim() && r.name.length <= MAX_NAME) out.name = r.name.trim();
  const image = soundcloudImage(r.image);
  if (image) out.image = image;
  return out;
}

const plain = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ');

/**
 * The page links to try for an artist, most likely first, at most
 * MAX_CANDIDATES: "john-summit", "johnsummit", then "johnsummitmusic".
 * None for b2b acts (they have no page of their own) or names with too few
 * letters to be sure of.
 */
export function candidateUrls(artistName: string, max = MAX_CANDIDATES): string[] {
  if (b2bParts(artistName)) return [];
  const words = plain(artistName)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const joined = words.join('');
  if (joined.length < 2) return [];
  const slugs = [words.join('-'), joined, `${joined}music`];
  return [...new Set(slugs)]
    .filter((s) => s.length <= 100)
    .slice(0, max)
    .map((s) => `https://soundcloud.com/${s}`);
}

/** SoundCloud's public oEmbed endpoint for a page (no key). */
export const oembedUrl = (pageUrl: string) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(pageUrl)}`;

/**
 * The profile in an oEmbed answer, only when SoundCloud's name for the page
 * (`author_name`) is the artist's name exactly. Keeps the page link
 * SoundCloud gives (`author_url`, when it's a SoundCloud page; otherwise the
 * link asked about), the name and the picture.
 */
export function pickProfile(artistName: string, askedUrl: string, answer: unknown): SoundCloudProfile | undefined {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return undefined;
  const a = answer as Record<string, unknown>;
  const want = fold(artistName);
  if (!want || typeof a.author_name !== 'string' || fold(a.author_name) !== want) return undefined;
  const url = soundcloudUrl(a.author_url) ?? soundcloudUrl(askedUrl);
  if (!url) return undefined;
  const out: SoundCloudProfile = { url };
  const name = a.author_name.trim();
  if (name && name.length <= MAX_NAME) out.name = name;
  const image = soundcloudImage(a.thumbnail_url);
  if (image) out.image = image;
  return out;
}

const day = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));

export type SoundCloudPlan = {
  /** Profiles found on earlier nights, kept without asking again. */
  keep: Record<string, SoundCloudProfile>;
  /** Misses still too recent to ask again. */
  misses: Record<string, string>;
  /** Tonight's artists to look up, in order (the job stops when the night's requests run out). */
  lookUp: { id: string; name: string }[];
};

/**
 * What tonight's job does, for the artists in order (the ones that matter
 * most first): artists with a link of their own are skipped (and any match
 * for them dropped), earlier finds are kept, misses younger than
 * RETRY_MISSES_DAYS wait, and the rest are looked up. Entries for artists no
 * longer on Afterglow are dropped.
 */
export function soundcloudPlan(
  artists: readonly { id: string; name: string; soundcloud?: string }[],
  published: Record<string, SoundCloudProfile>,
  misses: Record<string, string>,
  today: string,
): SoundCloudPlan {
  const keep: Record<string, SoundCloudProfile> = {};
  const waiting: Record<string, string> = {};
  const lookUp: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const a of artists) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    if (a.soundcloud) continue; // set by hand: never looked up
    const found = soundcloudProfile(published[a.id]);
    if (found) {
      keep[a.id] = found;
      continue;
    }
    if (!candidateUrls(a.name).length) continue;
    const missed = misses[a.id];
    if (typeof missed === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(missed) && (day(today) - day(missed)) / 86_400_000 < RETRY_MISSES_DAYS) {
      waiting[a.id] = missed;
      continue;
    }
    lookUp.push({ id: a.id, name: a.name });
  }
  return { keep, misses: waiting, lookUp };
}

/** What one oEmbed request came back with, as the job saw it. */
export type Asked = { status: 'found'; profile: SoundCloudProfile } | { status: 'not-found' } | { status: 'failed' };

/** How an oEmbed answer reads: found (the right artist), not found (no page, or someone else's), or failed (network, blocked, overloaded). */
export function readAnswer(artistName: string, askedUrl: string, httpStatus: number, body: unknown): Asked {
  if (httpStatus === 200) {
    const profile = pickProfile(artistName, askedUrl, body);
    return profile ? { status: 'found', profile } : { status: 'not-found' };
  }
  // No such page (404), or one SoundCloud won't show (private, removed).
  if (httpStatus === 404 || httpStatus === 410 || httpStatus === 401) return { status: 'not-found' };
  return { status: 'failed' };
}

/**
 * Tonight's lookups, with `ask` doing each request: each artist's links in
 * order until one is theirs, while requests last. An artist whose links all
 * came back not found is a miss (dated today); one interrupted by a failure
 * or the night's limit isn't, so it's tried again tomorrow. Stops early
 * after `maxFailures` failed requests (SoundCloud blocking or down).
 */
export async function lookUpProfiles(
  lookUp: readonly { id: string; name: string }[],
  ask: (url: string, artistName: string) => Promise<Asked>,
  today: string,
  { maxRequests = MAX_REQUESTS, maxFailures = 10 }: { maxRequests?: number; maxFailures?: number } = {},
): Promise<{ found: Record<string, SoundCloudProfile>; missed: Record<string, string>; asked: number; failures: number; stopped: boolean }> {
  const found: Record<string, SoundCloudProfile> = {};
  const missed: Record<string, string> = {};
  let asked = 0;
  let failures = 0;
  let stopped = false;
  for (const a of lookUp) {
    if (asked >= maxRequests || failures >= maxFailures) break;
    let failed = false;
    let complete = true;
    for (const url of candidateUrls(a.name)) {
      if (asked >= maxRequests || failures >= maxFailures) {
        complete = false;
        break;
      }
      asked++;
      const r = await ask(url, a.name);
      if (r.status === 'found') {
        found[a.id] = r.profile;
        break;
      }
      if (r.status === 'failed') {
        failures++;
        failed = true;
      }
    }
    if (!found[a.id] && complete && !failed) missed[a.id] = today;
  }
  if (failures >= maxFailures) stopped = true;
  return { found, missed, asked, failures, stopped };
}
