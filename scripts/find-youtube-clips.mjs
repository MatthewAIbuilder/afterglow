#!/usr/bin/env node
/**
 * Finds live-set clips for the Discover feed using only YouTube's official
 * Data API (v3). Developer tool: it never runs in the app and never
 * downloads, scrapes or re-hosts video.
 *
 *   YOUTUBE_API_KEY=... node scripts/find-youtube-clips.mjs
 *
 * 1. Resolves each channel handle below and prints its real title and size,
 *    so a person can confirm it is the official channel.
 * 2. Reads each channel's uploads and keeps live-set videos by our artists.
 * 3. Checks every candidate: public, embeddable, not region-blocked in the US,
 *    its length, and whether it is vertical (Shorts) or horizontal.
 *
 * Output: scripts/out/clip-candidates.json (git-ignored) plus a summary.
 * Quota: about 1 unit per 50 videos; a full run uses well under 1% of the free daily quota.
 */
import { mkdir, writeFile } from 'node:fs/promises';

const KEY = process.env.YOUTUBE_API_KEY;
if (!KEY) {
  console.error('Set YOUTUBE_API_KEY first.');
  process.exit(1);
}

/** Our prototype's artists (src/data/artists.ts) and the names they appear under in titles. */
const ARTISTS = [
  { id: 'illenium', names: ['illenium'] },
  { id: 'subtronics', names: ['subtronics'] },
  { id: 'excision', names: ['excision'] },
  { id: 'levity', names: ['levity'] },
  { id: 'tape-b', names: ['tape b'] },
  { id: 'sara-landry', names: ['sara landry'] },
  { id: 'john-summit', names: ['john summit'] },
];

/**
 * Candidate official channels. `artist` marks an artist's own channel (every upload is theirs,
 * so only live-looking titles are kept); the rest are festivals, events and labels.
 * Handles that don't resolve are reported and skipped.
 */
const CHANNELS = [
  { handle: '@ILLENIUM', artist: 'illenium' },
  { handle: '@Subtronics', artist: 'subtronics' },
  { handle: '@Excision', artist: 'excision' },
  { handle: '@LevityMusic', artist: 'levity' },
  { handle: '@tapebbeats', artist: 'tape-b' },
  { handle: '@SaraLandry', artist: 'sara-landry' },
  { handle: '@JohnSummit', artist: 'john-summit' },
  { handle: '@LostLandsFestival' },
  { handle: '@insomniac' },
  { handle: '@tomorrowland' },
  { handle: '@boilerroom' },
  { handle: '@awakenings' },
  { handle: '@ultramusicfestival' },
  { handle: '@ElectricForestFestival' },
  { handle: '@BassCanyon' },
  { handle: '@RottunRecordings' },
  { handle: '@CyclopsRecordings' },
  { handle: '@Cercle' },
];

/** Pages of 50 uploads to read per channel (newest first). */
const PAGES = Number(process.env.PAGES ?? 20);

const LIVE = /\b(live|full set|set|festival|lost lands|edc|tomorrowland|ultra|red rocks|boiler room|awakenings|electric forest|bass canyon|apocalypse|beyond wonderland|escape|dreamstate|stage|mainstage|drop|b2b)\b|@/i;
const NOT_LIVE = /\b(official (music )?video|lyric|lyrics|visuali[sz]er|audio|interview|trailer|teaser|announce|podcast|tutorial|reaction|unboxing|behind the scenes)\b/i;
const SHARED = /\b(b2b|b3b|vs\.?)\b/i;

const api = async (path, params) => {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries({ ...params, key: KEY })) url.searchParams.set(k, String(v));
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(`${path}: ${body?.error?.message ?? res.status}`);
  return body;
};

const seconds = (iso) => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso ?? '') ?? [];
  return (Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0);
};

const artistsIn = (title) => {
  const t = title.toLowerCase();
  return ARTISTS.filter((a) => a.names.some((n) => new RegExp(`\\b${n.replace(' ', '\\s+')}\\b`).test(t))).map((a) => a.id);
};

async function main() {
  const channels = [];
  for (const c of CHANNELS) {
    const r = await api('channels', { part: 'snippet,contentDetails,statistics', forHandle: c.handle });
    const ch = r.items?.[0];
    if (!ch) {
      console.log(`  not found  ${c.handle}`);
      continue;
    }
    const info = {
      ...c,
      id: ch.id,
      title: ch.snippet.title,
      customUrl: ch.snippet.customUrl,
      subscribers: Number(ch.statistics.subscriberCount ?? 0),
      uploads: ch.contentDetails.relatedPlaylists.uploads,
    };
    channels.push(info);
    console.log(`  channel    ${c.handle.padEnd(24)} ${info.title}  (${info.subscribers.toLocaleString()} subscribers)`);
  }

  const picked = new Map();
  for (const ch of channels) {
    let pageToken;
    for (let page = 0; page < PAGES; page++) {
      const r = await api('playlistItems', { part: 'snippet', playlistId: ch.uploads, maxResults: 50, ...(pageToken && { pageToken }) });
      for (const item of r.items ?? []) {
        const title = item.snippet.title;
        const videoId = item.snippet.resourceId.videoId;
        if (NOT_LIVE.test(title)) continue;
        const found = ch.artist ? [ch.artist] : artistsIn(title);
        if (found.length !== 1) continue; // one artist per clip for now
        if (!ch.artist && SHARED.test(title)) continue; // back-to-back sets can't be credited yet
        if (ch.artist && !LIVE.test(title)) continue;
        picked.set(videoId, { videoId, title, artistId: found[0], channelHandle: ch.handle });
      }
      pageToken = r.nextPageToken;
      if (!pageToken) break;
    }
  }

  // Official details for every candidate, 50 at a time.
  const ids = [...picked.keys()];
  const results = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await api('videos', {
      part: 'snippet,contentDetails,status,player',
      id: ids.slice(i, i + 50).join(','),
      maxHeight: 1280,
    });
    for (const v of r.items ?? []) {
      const base = picked.get(v.id);
      const w = Number(v.player?.embedWidth ?? 0);
      const h = Number(v.player?.embedHeight ?? 0);
      const blocked = v.contentDetails.regionRestriction?.blocked ?? [];
      const allowed = v.contentDetails.regionRestriction?.allowed;
      results.push({
        ...base,
        channel: v.snippet.channelTitle,
        channelId: v.snippet.channelId,
        publishedAt: v.snippet.publishedAt,
        durationSec: seconds(v.contentDetails.duration),
        vertical: h > w && w > 0,
        embeddable: v.status.embeddable === true,
        public: v.status.privacyStatus === 'public',
        madeForKids: v.status.madeForKids === true,
        usBlocked: blocked.includes('US') || (allowed ? !allowed.includes('US') : false),
        live: v.snippet.liveBroadcastContent !== 'none',
      });
    }
  }

  const usable = results.filter((r) => r.embeddable && r.public && !r.usBlocked && !r.madeForKids && !r.live);
  await mkdir(new URL('./out/', import.meta.url), { recursive: true });
  await writeFile(
    new URL('./out/clip-candidates.json', import.meta.url),
    JSON.stringify({ channels, usable, rejected: results.filter((r) => !usable.includes(r)) }, null, 2),
  );

  console.log(`\n${usable.length} usable of ${results.length} candidates`);
  for (const a of ARTISTS) {
    const mine = usable.filter((r) => r.artistId === a.id);
    console.log(`  ${a.id.padEnd(12)} ${mine.filter((r) => r.vertical).length} vertical, ${mine.filter((r) => !r.vertical).length} horizontal`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
